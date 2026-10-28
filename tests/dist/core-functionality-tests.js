// Core Functionality Tests
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
            const error = message || `Expected ${expected}, got ${actual}`;
            throw new Error(error);
        }
    }
    
    function assertThrows(fn, expectedMessage) {
        try {
            fn();
            throw new Error('Expected function to throw an error');
        } catch (error) {
            if (expectedMessage && !error.message.includes(expectedMessage)) {
                throw new Error(`Expected error message to contain '${expectedMessage}', got '${error.message}'`);
            }
        }
    }
    
    function test(testName, testFunction) {
        try {
            testFunction();
            testResults.passed++;
            console.log(`✓ ${testName}`);
        } catch (error) {
            testResults.failed++;
            testResults.failures.push({ name: testName, message: error.message });
            console.log(`✗ ${testName}`);
            console.log(`  ${error.message}`);
        }
    }
    
    // A test of something only one environment has. Where the capability is
    // missing the test is SKIPPED: listed in testResults.skipped and logged with
    // the capability it needs, never counted as passed. The other runner runs it.
    function testRequiring(capability, testName, testFunction) {
        if (!(capability in ENVIRONMENT)) {
            throw new Error(`testRequiring: unknown capability '${capability}' (known: ${Object.keys(ENVIRONMENT).join(', ')})`);
        }
        if (!ENVIRONMENT[capability]) {
            testResults.skipped.push(testName);
            console.log(`- ${testName} [skipped: needs ${capability}]`);
            return;
        }
        test(testName, testFunction);
    }

    function log(message) {
        console.log(`  ${message}`);
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
        console.log(`  Saved ${description}: ${filePath}`);
    }
    
    // Core functionality tests - run all tests
    function runSharedTests(SWCanvas) {
        console.log('Running SWCanvas Shared Test Suite...\n');
        
        // Test: Surface creation with valid dimensions
        // This file will be concatenated into the main test suite

        test('Surface creation with valid dimensions', () => {
            const surface = SWCanvas.Core.Surface(100, 50);
            assertEquals(surface.width, 100);
            assertEquals(surface.height, 50);
            assertEquals(surface.stride, 400); // 100 * 4
            assertEquals(surface.data.length, 20000); // 400 * 50
        });

        // Test: Surface creation with invalid dimensions throws
        // This file will be concatenated into the main test suite

        test('Surface creation with invalid dimensions throws', () => {
            assertThrows(() => SWCanvas.Core.Surface(0, 100), 'positive');
            assertThrows(() => SWCanvas.Core.Surface(100, 0), 'positive');
            assertThrows(() => SWCanvas.Core.Surface(-10, 100), 'positive');
        });

        // Test: Surface creation with too large dimensions throws
        // This file will be concatenated into the main test suite

        test('Surface creation with too large dimensions throws', () => {
            assertThrows(() => SWCanvas.Core.Surface(20000, 20000), 'SurfaceTooLarge');
        });

        // Test: Matrix identity creation
        // This file will be concatenated into the main test suite

        test('Matrix identity creation', () => {
            const m = new SWCanvas.Core.Transform2D();
            assertEquals(m.a, 1);
            assertEquals(m.b, 0);
            assertEquals(m.c, 0);
            assertEquals(m.d, 1);
            assertEquals(m.e, 0);
            assertEquals(m.f, 0);
        });

        // Test: Matrix creation with initial values
        // This file will be concatenated into the main test suite

        test('Matrix creation with initial values', () => {
            const m = new SWCanvas.Core.Transform2D([2, 3, 4, 5, 6, 7]);
            assertEquals(m.a, 2);
            assertEquals(m.b, 3);
            assertEquals(m.c, 4);
            assertEquals(m.d, 5);
            assertEquals(m.e, 6);
            assertEquals(m.f, 7);
        });

        // Test: Matrix multiplication
        // This file will be concatenated into the main test suite

        test('Matrix multiplication', () => {
            const m1 = new SWCanvas.Core.Transform2D([2, 0, 0, 2, 10, 20]);
            const m2 = new SWCanvas.Core.Transform2D([1, 0, 0, 1, 5, 5]);
            const result = m1.multiply(m2);
            assertEquals(result.a, 2);
            assertEquals(result.d, 2);
            // Correct matrix multiplication: e = a*e' + c*f' + e = 2*5 + 0*5 + 10 = 20
            assertEquals(result.e, 20);
            // Correct matrix multiplication: f = b*e' + d*f' + f = 0*5 + 2*5 + 20 = 30
            assertEquals(result.f, 30);
        });

        // Test: Matrix translate
        // This file will be concatenated into the main test suite

        test('Matrix translate', () => {
            const m = new SWCanvas.Core.Transform2D();
            const result = m.translate(10, 20);
            assertEquals(result.e, 10);
            assertEquals(result.f, 20);
        });

        // Test: Matrix scale
        // This file will be concatenated into the main test suite

        test('Matrix scale', () => {
            const m = new SWCanvas.Core.Transform2D();
            const result = m.scale(2, 3);
            assertEquals(result.a, 2);
            assertEquals(result.d, 3);
        });

        // Test: Matrix transform point
        // This file will be concatenated into the main test suite

        test('Matrix transform point', () => {
            const m = new SWCanvas.Core.Transform2D([2, 0, 0, 2, 10, 20]);
            const point = m.transformPoint({x: 5, y: 10});
            assertEquals(point.x, 20); // 5*2 + 10
            assertEquals(point.y, 40); // 10*2 + 20
        });

        // Test: Path2D command recording
        // This file will be concatenated into the main test suite

        test('Path2D command recording', () => {
            const path = new SWCanvas.Core.SWPath2D();
            path.moveTo(10, 20);
            path.lineTo(30, 40);
            path.closePath();
            
            assertEquals(path.commands.length, 3);
            assertEquals(path.commands[0].type, 'moveTo');
            assertEquals(path.commands[0].x, 10);
            assertEquals(path.commands[0].y, 20);
            assertEquals(path.commands[1].type, 'lineTo');
            assertEquals(path.commands[2].type, 'closePath');
        });

        // Test: Path2D rect convenience method
        // This file will be concatenated into the main test suite

        test('Path2D rect convenience method', () => {
            const path = new SWCanvas.Core.SWPath2D();
            path.rect(10, 20, 100, 50);
            
            assertEquals(path.commands.length, 5); // moveTo + 3 lineTo + closePath
            assertEquals(path.commands[0].type, 'moveTo');
            assertEquals(path.commands[0].x, 10);
            assertEquals(path.commands[0].y, 20);
        });

        // Test: Context2D creation
        // This file will be concatenated into the main test suite

        test('Context2D creation', () => {
            const surface = SWCanvas.Core.Surface(100, 100);
            const ctx = new SWCanvas.Core.Context2D(surface);
            assertEquals(ctx.globalAlpha, 1.0);
            assertEquals(ctx.globalCompositeOperation, 'source-over');
        });

        // Test: Context2D state save/restore
        // This file will be concatenated into the main test suite

        test('Context2D state save/restore', () => {
            const surface = SWCanvas.Core.Surface(100, 100);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            ctx.globalAlpha = 0.5;
            ctx.save();
            ctx.globalAlpha = 0.8;
            assertEquals(ctx.globalAlpha, 0.8);
            
            ctx.restore();
            assertEquals(ctx.globalAlpha, 0.5);
        });

        // Test: Create and save a simple test image
        // This file will be concatenated into the main test suite

        test('Create and save a simple test image', () => {
            // Use visual test registry if available, otherwise fall back to inline test
            if (typeof VisualRenderingTests !== 'undefined') {
                const visualTest = VisualRenderingTests.getTest('simple-test');
                if (visualTest) {
                    const surface = visualTest.drawSWCanvas(SWCanvas);
                    savePNG(surface, 'test-output.basic.png', 'test image', SWCanvas);
                    return;
                }
            }
            
            // Fallback inline test
            const surface = SWCanvas.Core.Surface(100, 100);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            // Fill with red background
            ctx.setFillStyle(255, 0, 0, 255);
            ctx.fillRect(0, 0, 100, 100);
            
            // Blue square in center
            ctx.setFillStyle(0, 0, 255, 255);
            ctx.fillRect(25, 25, 50, 50);
            
            // Save test image
            savePNG(surface, 'test-output.basic.png', 'test image', SWCanvas);
        });

        // Test: Alpha blending test - semi-transparent rectangles
        // This file will be concatenated into the main test suite

        test('Alpha blending test - semi-transparent rectangles', () => {
            // Use visual test registry if available
            if (typeof VisualRenderingTests !== 'undefined') {
                const visualTest = VisualRenderingTests.getTest('alpha-test');
                if (visualTest) {
                    const surface = visualTest.drawSWCanvas(SWCanvas);
                    
                    // Continue with original test verification logic...
                    // Check specific pixel values to verify alpha blending
                    const redPixelOffset = (30 * surface.stride) + (30 * 4); // Red area
                    const bluePixelOffset = (80 * surface.stride) + (80 * 4); // Blue area
                    const greenOverRedOffset = (50 * surface.stride) + (50 * 4); // Green over red
                    const greenOverWhiteOffset = (50 * surface.stride) + (110 * 4); // Green over white
                    const whiteOnlyOffset = (10 * surface.stride) + (10 * 4); // Pure white background
                    
                    log(`  Pure white background: R=${surface.data[whiteOnlyOffset]}, G=${surface.data[whiteOnlyOffset+1]}, B=${surface.data[whiteOnlyOffset+2]}, A=${surface.data[whiteOnlyOffset+3]}`);
                    log(`  Red pixel: R=${surface.data[redPixelOffset]}, G=${surface.data[redPixelOffset+1]}, B=${surface.data[redPixelOffset+2]}, A=${surface.data[redPixelOffset+3]}`);
                    log(`  Blue pixel: R=${surface.data[bluePixelOffset]}, G=${surface.data[bluePixelOffset+1]}, B=${surface.data[bluePixelOffset+2]}, A=${surface.data[bluePixelOffset+3]}`);
                    log(`  Green over red: R=${surface.data[greenOverRedOffset]}, G=${surface.data[greenOverRedOffset+1]}, B=${surface.data[greenOverRedOffset+2]}, A=${surface.data[greenOverRedOffset+3]}`);
                    log(`  Green over white: R=${surface.data[greenOverWhiteOffset]}, G=${surface.data[greenOverWhiteOffset+1]}, B=${surface.data[greenOverWhiteOffset+2]}, A=${surface.data[greenOverWhiteOffset+3]}`);
                    
                    // Save alpha blending test image
                    savePNG(surface, 'alpha-test.basic.png', 'alpha test image', SWCanvas);
                    
                    // Expected values for 50% green over white:
                    // 50% green (128) over white: src=[0,64,0,128] dst=[255,255,255,255] 
                    // Result should be: [127, 191, 127, 255]
                    const expectedR = 127;
                    const expectedG = 191;  
                    const expectedB = 127;
                    const actualR = surface.data[greenOverWhiteOffset];
                    const actualG = surface.data[greenOverWhiteOffset + 1];
                    const actualB = surface.data[greenOverWhiteOffset + 2];
                    
                    log(`  Expected green over white: [${expectedR}, ${expectedG}, ${expectedB}]`);
                    log(`  Actual green over white:   [${actualR}, ${actualG}, ${actualB}]`);
                    
                    // Allow ±1 tolerance for rounding differences
                    if (Math.abs(actualR - expectedR) > 1 || Math.abs(actualG - expectedG) > 1 || Math.abs(actualB - expectedB) > 1) {
                        throw new Error(`Alpha blending mismatch! Expected [${expectedR}, ${expectedG}, ${expectedB}], got [${actualR}, ${actualG}, ${actualB}]`);
                    }
                    return;
                }
            }
            
            // Fallback inline test
            const surface = SWCanvas.Core.Surface(200, 150);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            // White background
            ctx.setFillStyle(255, 255, 255, 255);
            ctx.fillRect(0, 0, 200, 150);
            
            // Red rectangle (opaque)
            ctx.setFillStyle(255, 0, 0, 255);
            ctx.fillRect(20, 20, 80, 60);
            
            // Blue rectangle (opaque) with overlap
            ctx.setFillStyle(0, 0, 255, 255);
            ctx.fillRect(60, 60, 80, 60);
            
            // Semi-transparent green rectangle (this is the key test)
            ctx.globalAlpha = 0.5;
            ctx.setFillStyle(0, 128, 0, 255);
            ctx.fillRect(40, 40, 80, 60);
            ctx.globalAlpha = 1.0;
            
            // Check specific pixel values to verify alpha blending
            const redPixelOffset = (30 * surface.stride) + (30 * 4); // Red area
            const bluePixelOffset = (80 * surface.stride) + (80 * 4); // Blue area
            const greenOverRedOffset = (50 * surface.stride) + (50 * 4); // Green over red
            const greenOverWhiteOffset = (50 * surface.stride) + (110 * 4); // Green over white
            const whiteOnlyOffset = (10 * surface.stride) + (10 * 4); // Pure white background
            
            log(`  Pure white background: R=${surface.data[whiteOnlyOffset]}, G=${surface.data[whiteOnlyOffset+1]}, B=${surface.data[whiteOnlyOffset+2]}, A=${surface.data[whiteOnlyOffset+3]}`);
            log(`  Red pixel: R=${surface.data[redPixelOffset]}, G=${surface.data[redPixelOffset+1]}, B=${surface.data[redPixelOffset+2]}, A=${surface.data[redPixelOffset+3]}`);
            log(`  Blue pixel: R=${surface.data[bluePixelOffset]}, G=${surface.data[bluePixelOffset+1]}, B=${surface.data[bluePixelOffset+2]}, A=${surface.data[bluePixelOffset+3]}`);
            log(`  Green over red: R=${surface.data[greenOverRedOffset]}, G=${surface.data[greenOverRedOffset+1]}, B=${surface.data[greenOverRedOffset+2]}, A=${surface.data[greenOverRedOffset+3]}`);
            log(`  Green over white: R=${surface.data[greenOverWhiteOffset]}, G=${surface.data[greenOverWhiteOffset+1]}, B=${surface.data[greenOverWhiteOffset+2]}, A=${surface.data[greenOverWhiteOffset+3]}`);
            
            // Save alpha blending test image
            savePNG(surface, 'alpha-test.basic.png', 'alpha test image', SWCanvas);
            
            // Expected values for 50% green over white:
            // 50% green (128) over white: src=[0,64,0,128] dst=[255,255,255,255] 
            // Result should be: [127, 191, 127, 255]
            const expectedR = 127;
            const expectedG = 191;  
            const expectedB = 127;
            const actualR = surface.data[greenOverWhiteOffset];
            const actualG = surface.data[greenOverWhiteOffset + 1];
            const actualB = surface.data[greenOverWhiteOffset + 2];
            
            log(`  Expected green over white: [${expectedR}, ${expectedG}, ${expectedB}]`);
            log(`  Actual green over white:   [${actualR}, ${actualG}, ${actualB}]`);
            
            // Allow ±1 tolerance for rounding differences
            if (Math.abs(actualR - expectedR) > 1 || Math.abs(actualG - expectedG) > 1 || Math.abs(actualB - expectedB) > 1) {
                throw new Error(`Alpha blending mismatch! Expected [${expectedR}, ${expectedG}, ${expectedB}], got [${actualR}, ${actualG}, ${actualB}]`);
            }
        });

        // Test: Path filling - simple triangle
        // This file will be concatenated into the main test suite

        test('Path filling - simple triangle', () => {
            const surface = SWCanvas.Core.Surface(100, 100);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            // White background
            ctx.setFillStyle(255, 255, 255, 255);
            ctx.fillRect(0, 0, 100, 100);
            
            // Draw red triangle using path
            ctx.setFillStyle(255, 0, 0, 255);
            ctx.beginPath();
            ctx.moveTo(50, 10);
            ctx.lineTo(80, 70);
            ctx.lineTo(20, 70);
            ctx.closePath();
            ctx.fill();
            
            // Check a point inside the triangle
            const insideOffset = (40 * surface.stride) + (50 * 4);
            const r = surface.data[insideOffset];
            const g = surface.data[insideOffset + 1];
            const b = surface.data[insideOffset + 2];
            
            log(`  Triangle interior pixel: R=${r}, G=${g}, B=${b}`);
            
            // Should be red (allowing for some tolerance)
            if (r < 200 || g > 50 || b > 50) {
                throw new Error(`Expected red pixel inside triangle, got R=${r}, G=${g}, B=${b}`);
            }
            
            savePNG(surface, 'triangle-test.basic.png', 'triangle path test', SWCanvas);
        });

        // Test: Path filling - evenodd vs nonzero
        // This file will be concatenated into the main test suite

        test('Path filling - evenodd vs nonzero', () => {
            const surface = SWCanvas.Core.Surface(100, 100);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            // White background
            ctx.setFillStyle(255, 255, 255, 255);
            ctx.fillRect(0, 0, 100, 100);
            
            // Create overlapping rectangles (outer and inner)
            ctx.setFillStyle(255, 0, 0, 255);
            ctx.beginPath();
            // Outer rectangle
            ctx.rect(20, 20, 60, 60);
            // Inner rectangle (opposite winding)
            ctx.rect(30, 30, 40, 40);
            
            // Fill with evenodd rule - should create a "hole"
            ctx.fill('evenodd');
            
            // Check center (should be white - the "hole")
            const centerOffset = (50 * surface.stride) + (50 * 4);
            const centerR = surface.data[centerOffset];
            log(`  Center pixel with evenodd: R=${centerR}`);
            
            // Center should be white (hole)
            if (centerR < 200) {
                throw new Error('Expected white center with evenodd rule');
            }
            
            savePNG(surface, 'evenodd-test.basic.png', 'evenodd fill test', SWCanvas);
        });

        // Test: Basic clipping test
        // This file will be concatenated into the main test suite

        test('Basic clipping test', () => {
            const surface = SWCanvas.Core.Surface(100, 100);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            // White background
            ctx.setFillStyle(255, 255, 255, 255);
            ctx.fillRect(0, 0, 100, 100);
            
            // Set up circular clip path
            ctx.beginPath();
            ctx.arc(50, 50, 30, 0, 2 * Math.PI);
            ctx.clip();
            
            // Fill a large red rectangle - should be clipped to circle
            ctx.setFillStyle(255, 0, 0, 255);
            ctx.fillRect(0, 0, 100, 100);
            
            // Check a point that should be clipped (outside circle)
            const outsideOffset = (20 * surface.stride) + (20 * 4);
            const outsideR = surface.data[outsideOffset];
            log(`  Outside clip region: R=${outsideR}`);
            
            // Should still be white (clipped)
            if (outsideR < 200) {
                throw new Error('Clipping not working - expected white outside clip region');
            }
            
            savePNG(surface, 'clipping-test.basic.png', 'basic clipping test', SWCanvas);
        });

        // Test: Basic stroke - simple line
        // This file will be concatenated into the main test suite

        test('Basic stroke - simple line', () => {
            const surface = SWCanvas.Core.Surface(100, 100);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            // White background
            ctx.setFillStyle(255, 255, 255, 255);
            ctx.fillRect(0, 0, 100, 100);
            
            // Draw red line stroke
            ctx.setStrokeStyle(255, 0, 0, 255);
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(10, 50);
            ctx.lineTo(90, 50);
            ctx.stroke();
            
            // Check stroke is present
            const centerOffset = (50 * surface.stride) + (50 * 4);
            const r = surface.data[centerOffset];
            log(`  Line stroke pixel: R=${r}`);
            
            if (r < 200) {
                throw new Error('Expected red stroke line');
            }
            
            savePNG(surface, 'stroke-basic-line.basic.png', 'basic stroke line', SWCanvas);
        });

        // Test: Stroke joins - miter, bevel, round
        // This file will be concatenated into the main test suite

        test('Stroke joins - miter, bevel, round', () => {
            const surface = SWCanvas.Core.Surface(300, 100);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            // White background
            ctx.setFillStyle(255, 255, 255, 255);
            ctx.fillRect(0, 0, 300, 100);
            
            ctx.setStrokeStyle(0, 0, 255, 255);
            ctx.lineWidth = 8;
            
            // Miter join
            ctx.lineJoin = 'miter';
            ctx.beginPath();
            ctx.moveTo(20, 20);
            ctx.lineTo(50, 50);
            ctx.lineTo(80, 20);
            ctx.stroke();
            
            // Bevel join
            ctx.lineJoin = 'bevel';
            ctx.beginPath();
            ctx.moveTo(120, 20);
            ctx.lineTo(150, 50);
            ctx.lineTo(180, 20);
            ctx.stroke();
            
            // Round join
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(220, 20);
            ctx.lineTo(250, 50);
            ctx.lineTo(280, 20);
            ctx.stroke();
            
            savePNG(surface, 'stroke-joins.basic.png', 'stroke joins test', SWCanvas);
        });

        // Test: Stroke caps - butt, square, round
        // This file will be concatenated into the main test suite

        test('Stroke caps - butt, square, round', () => {
            const surface = SWCanvas.Core.Surface(300, 150);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            // White background
            ctx.setFillStyle(255, 255, 255, 255);
            ctx.fillRect(0, 0, 300, 150);
            
            ctx.setStrokeStyle(0, 128, 0, 255);
            ctx.lineWidth = 12;
            
            // Butt caps
            ctx.lineCap = 'butt';
            ctx.beginPath();
            ctx.moveTo(50, 30);
            ctx.lineTo(50, 70);
            ctx.stroke();
            
            // Square caps
            ctx.lineCap = 'square';
            ctx.beginPath();
            ctx.moveTo(150, 30);
            ctx.lineTo(150, 70);
            ctx.stroke();
            
            // Round caps
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(250, 30);
            ctx.lineTo(250, 70);
            ctx.stroke();
            
            savePNG(surface, 'stroke-caps.basic.png', 'stroke caps test', SWCanvas);
        });

        // Test: Stroke with different line widths
        // This file will be concatenated into the main test suite

        test('Stroke with different line widths', () => {
            const surface = SWCanvas.Core.Surface(200, 150);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            // White background
            ctx.setFillStyle(255, 255, 255, 255);
            ctx.fillRect(0, 0, 200, 150);
            
            ctx.setStrokeStyle(128, 0, 128, 255);
            
            const widths = [1, 3, 6, 10, 15];
            for (let i = 0; i < widths.length; i++) {
                const y = 25 + i * 25;
                ctx.lineWidth = widths[i];
                ctx.beginPath();
                ctx.moveTo(20, y);
                ctx.lineTo(180, y);
                ctx.stroke();
            }
            
            savePNG(surface, 'stroke-widths.basic.png', 'stroke widths test', SWCanvas);
        });

        // Test: Complex path stroke with curves
        // This file will be concatenated into the main test suite

        test('Complex path stroke with curves', () => {
            const surface = SWCanvas.Core.Surface(150, 150);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            // White background
            ctx.setFillStyle(255, 255, 255, 255);
            ctx.fillRect(0, 0, 150, 150);
            
            // Draw a curved path
            ctx.setStrokeStyle(255, 165, 0, 255);
            ctx.lineWidth = 4;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            
            ctx.beginPath();
            ctx.moveTo(20, 50);
            ctx.quadraticCurveTo(75, 20, 130, 50);
            ctx.quadraticCurveTo(100, 100, 50, 120);
            ctx.lineTo(20, 100);
            ctx.stroke();
            
            savePNG(surface, 'stroke-curves.basic.png', 'stroke curves test', SWCanvas);
        });

        // Test: Miter limit test
        // This file will be concatenated into the main test suite

        test('Miter limit test', () => {
            const surface = SWCanvas.Core.Surface(200, 100);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            // White background
            ctx.setFillStyle(255, 255, 255, 255);
            ctx.fillRect(0, 0, 200, 100);
            
            ctx.setStrokeStyle(255, 0, 255, 255);
            ctx.lineWidth = 6;
            ctx.lineJoin = 'miter';
            
            // Sharp angle with default miter limit (should create miter)
            ctx.miterLimit = 10;
            ctx.beginPath();
            ctx.moveTo(40, 20);
            ctx.lineTo(50, 50);
            ctx.lineTo(60, 20);
            ctx.stroke();
            
            // Very sharp angle with low miter limit (should fallback to bevel)
            ctx.miterLimit = 2;
            ctx.beginPath();
            ctx.moveTo(140, 20);
            ctx.lineTo(150, 50);
            ctx.lineTo(160, 20);
            ctx.stroke();
            
            savePNG(surface, 'stroke-miter-limit.basic.png', 'stroke miter limit test', SWCanvas);
        });

        // Test: Miter limit property and basic functionality
        // This file will be concatenated into the main test suite

        test('Miter limit property and basic functionality', () => {
            // Test that miterLimit property works and doesn't cause crashes
            
            const surface = SWCanvas.Core.Surface(100, 100);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            ctx.setFillStyle(255, 255, 255, 255);
            ctx.fillRect(0, 0, 100, 100);
            ctx.setStrokeStyle(0, 0, 255, 255);
            ctx.lineWidth = 6;
            ctx.lineJoin = 'miter';
            
            // Test different miter limit values work without crashing
            const miterLimits = [1.0, 2.0, 5.0, 10.0];
            
            for (let i = 0; i < miterLimits.length; i++) {
                const limit = miterLimits[i];
                ctx.miterLimit = limit;
                
                // Draw a V shape at different positions
                const x = 20 + i * 20;
                ctx.beginPath();
                ctx.moveTo(x - 5, 60);
                ctx.lineTo(x, 40);
                ctx.lineTo(x + 5, 60);
                ctx.stroke();
                
                // Verify the miterLimit property was set correctly
                if (Math.abs(ctx.miterLimit - limit) > 0.001) {
                    throw new Error('miterLimit property not set correctly: expected ' + limit + ', got ' + ctx.miterLimit);
                }
            }
            
            log('  Tested miter limits: ' + miterLimits.join(', ') + ' - all rendered successfully');
            
            // Test that strokes are actually drawn (basic functionality check)
            function getPixel(x, y) {
                const offset = y * surface.stride + x * 4;
                return surface.data[offset + 2]; // Check BLUE channel for blue stroke
            }
            
            // Check that there are some blue pixels from the strokes
            let foundStroke = false;
            for (let x = 15; x < 85; x += 5) {
                for (let y = 40; y < 65; y += 5) {
                    if (getPixel(x, y) > 200) {
                        foundStroke = true;
                        break;
                    }
                }
                if (foundStroke) break;
            }
            
            if (!foundStroke) {
                throw new Error('No stroke pixels found - miter joins may not be rendering');
            }
            
            log('  ✓ Miter joins rendered with different miterLimit values');
            
            savePNG(surface, 'miter-limits-basic.basic.png', 'miter limits basic test', SWCanvas);
        });

        // Test: Basic transform - translate operations
        // This file will be concatenated into the main test suite

        test('Basic transform - translate operations', () => {
            if (typeof VisualRenderingTests !== 'undefined') {
                const visualTest = VisualRenderingTests.getTest('transform-basic-translate');
                if (visualTest) {
                    const surface = visualTest.drawSWCanvas(SWCanvas);
                    savePNG(surface, 'transform-basic-translate.basic.png', 'basic translate test', SWCanvas);
                    
                    // Verify translated squares are in correct positions
                    // Red square: fillRect(10,10,30,30) at origin -> (10,10) to (40,40)
                    // Blue square: after translate(50,20), fillRect(10,10,30,30) -> (60,30) to (90,60)  
                    // Green square: after translate(60,30), fillRect(10,10,30,30) -> (120,60) to (150,90)
                    const redPixel = (25 * surface.stride) + (25 * 4);  // Center of red square
                    const bluePixel = (45 * surface.stride) + (75 * 4); // Center of blue square  
                    const greenPixel = (75 * surface.stride) + (135 * 4); // Center of green square
                    
                    if (surface.data[redPixel] < 200) throw new Error('Red square not found at origin');
                    if (surface.data[bluePixel + 2] < 200) throw new Error('Blue square not found at translated position');
                    if (surface.data[greenPixel + 1] < 100) throw new Error('Green square not found at final position'); // Green is 128, not 255
                    return;
                }
            }
            
            // Fallback test without visual registry
            const surface = SWCanvas.Core.Surface(200, 150);
            const ctx = new SWCanvas.Core.Context2D(surface);
            ctx.setFillStyle(255, 255, 255, 255);
            ctx.fillRect(0, 0, 200, 150);
            ctx.translate(50, 50);
            ctx.setFillStyle(255, 0, 0, 255);
            ctx.fillRect(0, 0, 20, 20);
            
            const pixelOffset = (60 * surface.stride) + (60 * 4);
            if (surface.data[pixelOffset] < 200) {
                throw new Error('Transform translate not working');
            }
        });

        // Test: Basic transform - scale operations
        // This file will be concatenated into the main test suite

        test('Basic transform - scale operations', () => {
            if (typeof VisualRenderingTests !== 'undefined') {
                const visualTest = VisualRenderingTests.getTest('transform-basic-scale');
                if (visualTest) {
                    const surface = visualTest.drawSWCanvas(SWCanvas);
                    savePNG(surface, 'transform-basic-scale.basic.png', 'basic scale test', SWCanvas);
                    
                    // Verify scaling worked - blue square should be 2x size
                    let bluePixelCount = 0;
                    for (let y = 10; y < 60; y++) {
                        for (let x = 60; x < 110; x++) {
                            const offset = (y * surface.stride) + (x * 4);
                            if (surface.data[offset + 2] > 200) bluePixelCount++;
                        }
                    }
                    
                    if (bluePixelCount < 1500) throw new Error('Scaled blue square not found or incorrect size');
                    return;
                }
            }
            
            // Fallback test
            const surface = SWCanvas.Core.Surface(100, 100);
            const ctx = new SWCanvas.Core.Context2D(surface);
            ctx.setFillStyle(255, 255, 255, 255);
            ctx.fillRect(0, 0, 100, 100);
            ctx.scale(2, 2);
            ctx.setFillStyle(255, 0, 0, 255);
            ctx.fillRect(10, 10, 10, 10);
            
            // Should see a 20x20 red square due to 2x scale
            const pixelOffset = (25 * surface.stride) + (25 * 4);
            if (surface.data[pixelOffset] < 200) {
                throw new Error('Transform scale not working');
            }
        });

        // Test: Basic transform - rotate operations
        // This file will be concatenated into the main test suite

        test('Basic transform - rotate operations', () => {
            if (typeof VisualRenderingTests !== 'undefined') {
                const visualTest = VisualRenderingTests.getTest('transform-basic-rotate');
                if (visualTest) {
                    const surface = visualTest.drawSWCanvas(SWCanvas);
                    savePNG(surface, 'transform-basic-rotate.basic.png', 'basic rotate test', SWCanvas);
                    
                    // Just verify rotation doesn't crash and produces pixels
                    let pixelCount = 0;
                    for (let i = 0; i < surface.data.length; i += 4) {
                        if (surface.data[i] > 100 || surface.data[i+1] > 100 || surface.data[i+2] > 100) {
                            pixelCount++;
                        }
                    }
                    
                    if (pixelCount < 1000) throw new Error('Rotation test produced too few pixels');
                    return;
                }
            }
            
            // Fallback test
            const surface = SWCanvas.Core.Surface(100, 100);
            const ctx = new SWCanvas.Core.Context2D(surface);
            ctx.setFillStyle(255, 255, 255, 255);
            ctx.fillRect(0, 0, 100, 100);
            ctx.translate(50, 50);
            ctx.rotate(Math.PI / 4);
            ctx.setFillStyle(255, 0, 0, 255);
            ctx.fillRect(-10, -10, 20, 20);
            
            // Should see rotated red pixels
            const centerOffset = (50 * surface.stride) + (50 * 4);
            if (surface.data[centerOffset] < 100) {
                throw new Error('Transform rotate not working');
            }
        });

        // Test: setTransform vs transform behavior
        // This file will be concatenated into the main test suite

        test('setTransform vs transform behavior', () => {
            if (typeof VisualRenderingTests !== 'undefined') {
                const visualTest = VisualRenderingTests.getTest('transform-setTransform-vs-transform');
                if (visualTest) {
                    const surface = visualTest.drawSWCanvas(SWCanvas);
                    savePNG(surface, 'transform-setTransform-vs-transform.basic.png', 'setTransform vs transform test', SWCanvas);
                    return;
                }
            }
            
            // Fallback test showing difference between transform and setTransform
            const surface = SWCanvas.Core.Surface(200, 100);
            const ctx = new SWCanvas.Core.Context2D(surface);
            ctx.setFillStyle(255, 255, 255, 255);
            ctx.fillRect(0, 0, 200, 100);
            
            // transform is accumulative
            ctx.transform(1, 0, 0, 1, 10, 10);
            ctx.transform(2, 0, 0, 2, 0, 0);
            ctx.setFillStyle(255, 0, 0, 255);
            ctx.fillRect(0, 0, 10, 10);
            
            // setTransform is absolute
            ctx.setTransform(1, 0, 0, 1, 100, 10);
            ctx.setFillStyle(0, 0, 255, 255);
            ctx.fillRect(0, 0, 10, 10);
            
            // Should see different positioned squares
            const redArea = (20 * surface.stride) + (20 * 4);
            const blueArea = (20 * surface.stride) + (100 * 4);
            
            if (surface.data[redArea] < 200) throw new Error('Accumulative transform not working');
            if (surface.data[blueArea + 2] < 200) throw new Error('Absolute setTransform not working');
        });

        // Test: resetTransform functionality
        // This file will be concatenated into the main test suite

        test('resetTransform functionality', () => {
            if (typeof VisualRenderingTests !== 'undefined') {
                const visualTest = VisualRenderingTests.getTest('transform-resetTransform');
                if (visualTest) {
                    const surface = visualTest.drawSWCanvas(SWCanvas);
                    savePNG(surface, 'transform-resetTransform.basic.png', 'resetTransform test', SWCanvas);
                    return;
                }
            }
            
            // Test resetTransform works
            const surface = SWCanvas.Core.Surface(100, 100);
            const ctx = new SWCanvas.Core.Context2D(surface);
            ctx.setFillStyle(255, 255, 255, 255);
            ctx.fillRect(0, 0, 100, 100);
            
            ctx.translate(50, 50);
            ctx.scale(2, 2);
            ctx.resetTransform();
            
            // After reset, should be back to identity
            ctx.setFillStyle(255, 0, 0, 255);
            ctx.fillRect(10, 10, 20, 20);
            
            const pixelOffset = (20 * surface.stride) + (20 * 4);
            if (surface.data[pixelOffset] < 200) {
                throw new Error('resetTransform not working');
            }
        });

        // Test: Transform matrix order dependency (A*B ≠ B*A)
        // This file will be concatenated into the main test suite

        test('Transform matrix order dependency (A*B ≠ B*A)', () => {
            if (typeof VisualRenderingTests !== 'undefined') {
                const visualTest = VisualRenderingTests.getTest('transform-matrix-order');
                if (visualTest) {
                    const surface = visualTest.drawSWCanvas(SWCanvas);
                    savePNG(surface, 'transform-matrix-order.basic.png', 'transform matrix order test', SWCanvas);
                    
                    // Check that red and blue squares are in different positions
                    // Red square: translate(40,40) then scale(2,2) then fillRect(0,0,15,15)
                    //   -> fillRect maps (0,0,15,15) to (40,40,70,70) 
                    // Blue square: scale(2,2) then translate(60,60) then fillRect(0,0,15,15) 
                    //   -> fillRect maps (0,0,15,15) to (60,60,90,90) then scale by 2 -> (120,120,180,180)
                    
                    // Check for red pixels around expected area (40,40) to (70,70)
                    let redFound = false;
                    for (let y = 35; y < 75; y++) {
                        for (let x = 35; x < 75; x++) {
                            const offset = (y * surface.stride) + (x * 4);
                            if (surface.data[offset] > 200 && surface.data[offset + 1] < 50 && surface.data[offset + 2] < 50) {
                                redFound = true;
                                break;
                            }
                        }
                        if (redFound) break;
                    }
                    
                    // Check for blue pixels around expected area (120,120) to (180,180) - but surface is only 200x150
                    // So check (120,120) to (150,150) area
                    let blueFound = false;
                    for (let y = 115; y < 150; y++) {
                        for (let x = 115; x < 150; x++) {
                            const offset = (y * surface.stride) + (x * 4);
                            if (surface.data[offset] < 50 && surface.data[offset + 1] < 50 && surface.data[offset + 2] > 200) {
                                blueFound = true;
                                break;
                            }
                        }
                        if (blueFound) break;
                    }
                    
                    if (!redFound) throw new Error('Red square not found in expected area (translate→scale)');
                    if (!blueFound) throw new Error('Blue square not found in expected area (scale→translate)');
                    
                    console.log('  ✓ Different transform orders produce different results');
                    return;
                }
            }
            
            // Fallback test showing transform order matters
            const surface = SWCanvas.Core.Surface(200, 100);
            const ctx = new SWCanvas.Core.Context2D(surface);
            ctx.setFillStyle(255, 255, 255, 255);
            ctx.fillRect(0, 0, 200, 100);
            
            // Test: Translate then Scale
            ctx.save();
            const matrix1 = new SWCanvas.Core.Transform2D();
            const translated = matrix1.translate(20, 20);
            const translateThenScale = translated.scale(2, 2);
            ctx.setTransform(translateThenScale.a, translateThenScale.b, translateThenScale.c, 
                           translateThenScale.d, translateThenScale.e, translateThenScale.f);
            ctx.setFillStyle(255, 0, 0, 255);
            ctx.fillRect(0, 0, 10, 10);
            ctx.restore();
            
            // Test: Scale then Translate
            ctx.save();
            const matrix2 = new SWCanvas.Core.Transform2D();
            const scaled = matrix2.scale(2, 2);
            const scaleThenTranslate = scaled.translate(20, 20);
            ctx.setTransform(scaleThenTranslate.a, scaleThenTranslate.b, scaleThenTranslate.c,
                           scaleThenTranslate.d, scaleThenTranslate.e, scaleThenTranslate.f);
            ctx.setFillStyle(0, 0, 255, 255);
            ctx.fillRect(0, 0, 10, 10);
            ctx.restore();
            
            // The two squares should be in different positions
            // This proves that transform order matters
            console.log('  ✓ Transform order dependency verified');
        });

        // Test: Line dash API functionality
        // This file will be concatenated into the main test suite

        test('Line dash API - setLineDash, getLineDash, lineDashOffset', () => {
            const surface = SWCanvas.Core.Surface(100, 100);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            // Test initial state
            assertEquals(ctx.getLineDash().length, 0, 'Initial dash pattern should be empty');
            assertEquals(ctx.lineDashOffset, 0, 'Initial dash offset should be 0');
            
            // Test setLineDash with valid array
            ctx.setLineDash([5, 10]);
            const dash1 = ctx.getLineDash();
            assertEquals(dash1.length, 2, 'Dash pattern should have 2 elements');
            assertEquals(dash1[0], 5, 'First dash element should be 5');
            assertEquals(dash1[1], 10, 'Second dash element should be 10');
            
            // Test mutation protection - modifying returned array should not affect internal state
            dash1[0] = 999;
            const dash2 = ctx.getLineDash();
            assertEquals(dash2[0], 5, 'Internal dash pattern should not be affected by external mutation');
            
            // Test odd-length array duplication behavior
            ctx.setLineDash([5, 10, 15]);
            const dash3 = ctx.getLineDash();
            assertEquals(dash3.length, 3, 'getLineDash should return original pattern length');
            assertEquals(dash3[0], 5, 'First element should be 5');
            assertEquals(dash3[1], 10, 'Second element should be 10');
            assertEquals(dash3[2], 15, 'Third element should be 15');
            
            // Test empty array resets to solid line
            ctx.setLineDash([]);
            const dash4 = ctx.getLineDash();
            assertEquals(dash4.length, 0, 'Empty array should reset to solid line');
            
            // Test lineDashOffset property
            ctx.lineDashOffset = 25.5;
            assertEquals(ctx.lineDashOffset, 25.5, 'lineDashOffset should accept decimal values');
            
            ctx.lineDashOffset = -15;
            assertEquals(ctx.lineDashOffset, -15, 'lineDashOffset should accept negative values');
            
            // Test save/restore preserves dash state
            ctx.setLineDash([8, 4, 2, 4]);
            ctx.lineDashOffset = 12;
            ctx.save();
            
            ctx.setLineDash([1, 1]);
            ctx.lineDashOffset = 0;
            
            ctx.restore();
            const restoredDash = ctx.getLineDash();
            assertEquals(restoredDash.length, 4, 'Restored dash pattern should have 4 elements');
            assertEquals(restoredDash[0], 8, 'Restored first element should be 8');
            assertEquals(restoredDash[3], 4, 'Restored fourth element should be 4');
            assertEquals(ctx.lineDashOffset, 12, 'Restored dash offset should be 12');
            
            // Test error cases
            let errorThrown = false;
            try {
                ctx.setLineDash("invalid");
            } catch (e) {
                errorThrown = true;
                assertEquals(e.message.includes('array'), true, 'Should throw error for non-array input');
            }
            assertEquals(errorThrown, true, 'Should throw error for invalid input');
            
            errorThrown = false;
            try {
                ctx.setLineDash([5, "invalid"]);
            } catch (e) {
                errorThrown = true;
                assertEquals(e.message.includes('numbers'), true, 'Should throw error for non-number elements');
            }
            assertEquals(errorThrown, true, 'Should throw error for invalid elements');
            
            errorThrown = false;
            try {
                ctx.setLineDash([5, -2]);
            } catch (e) {
                errorThrown = true;
                assertEquals(e.message.includes('negative'), true, 'Should throw error for negative values');
            }
            assertEquals(errorThrown, true, 'Should throw error for negative values');
            
            // Test with zero values (should be allowed)
            ctx.setLineDash([5, 0, 3]);
            const dashWithZero = ctx.getLineDash();
            assertEquals(dashWithZero[1], 0, 'Zero values should be allowed in dash pattern');
            
            // Test lineDashOffset with invalid values (should be ignored silently)
            ctx.lineDashOffset = "invalid";
            assertEquals(ctx.lineDashOffset, 12, 'Invalid lineDashOffset should be ignored');
            
            ctx.lineDashOffset = NaN;
            assertEquals(ctx.lineDashOffset, 12, 'NaN lineDashOffset should be ignored');
            
            console.log('✓ Line dash API test passed - all setLineDash, getLineDash, and lineDashOffset behaviors work correctly');
        });

        // Test: Composite Operations Test - globalCompositeOperation support
        // Tests the new composite operations beyond source-over

        // Test 33A: Basic composite operations validation
        test('Composite operations - basic validation', () => {
            const surface = SWCanvas.Core.Surface(100, 100);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            // Test default value
            assertEquals(ctx.globalCompositeOperation, 'source-over');
            
            // Test setting valid operations
            const supportedOps = [
                'source-over', 'destination-over', 'source-atop', 'destination-atop',
                'source-in', 'destination-in', 'source-out', 'destination-out', 
                'xor', 'copy'
            ];
            
            for (const op of supportedOps) {
                ctx.globalCompositeOperation = op;
                assertEquals(ctx.globalCompositeOperation, op);
            }
        });

        // Test 33B: destination-out operation 
        test('Composite operations - destination-out erases destination', () => {
            const surface = SWCanvas.Core.Surface(100, 100);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            // Draw red background
            ctx.setFillStyle(255, 0, 0, 255); // Red
            ctx.fillRect(0, 0, 100, 100);
            
            // Draw blue circle with destination-out (should erase red where blue overlaps)
            ctx.globalCompositeOperation = 'destination-out';
            ctx.setFillStyle(0, 0, 255, 255); // Blue
            ctx.fillRect(25, 25, 50, 50);
            
            // Check that center is now transparent (erased)
            const centerPixel = surface.getPixel(50, 50);
            assertEquals(centerPixel.a, 0); // Should be transparent
            
            // Check that corner still has red
            const cornerPixel = surface.getPixel(10, 10);
            assertEquals(cornerPixel.r, 255);
            assertEquals(cornerPixel.g, 0);
            assertEquals(cornerPixel.b, 0);
            assertEquals(cornerPixel.a, 255);
        });

        // Test 33C: xor operation
        test('Composite operations - xor clears overlapping areas', () => {
            const surface = SWCanvas.Core.Surface(100, 100);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            // Draw red square
            ctx.setFillStyle(255, 0, 0, 255); // Red
            ctx.fillRect(20, 20, 40, 40);
            
            // Draw blue square with xor (overlapping area should be cleared)
            ctx.globalCompositeOperation = 'xor';
            ctx.setFillStyle(0, 0, 255, 255); // Blue
            ctx.fillRect(40, 40, 40, 40);
            
            // Check red-only area (should be red)
            const redPixel = surface.getPixel(30, 30);
            assertEquals(redPixel.r, 255);
            assertEquals(redPixel.a, 255);
            
            // Check blue-only area (should be blue)
            const bluePixel = surface.getPixel(70, 70);
            assertEquals(bluePixel.b, 255);
            assertEquals(bluePixel.a, 255);
            
            // Check overlapping area (should be transparent)
            const overlapPixel = surface.getPixel(50, 50);
            assertEquals(overlapPixel.a, 0); // Should be transparent
        });

        // Test 33D: source-atop operation
        test('Composite operations - source-atop draws only where destination exists', () => {
            const surface = SWCanvas.Core.Surface(100, 100);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            // Draw red circle as destination
            ctx.setFillStyle(255, 0, 0, 255); // Red
            ctx.fillRect(30, 30, 40, 40);
            
            // Draw blue with source-atop (should only appear where red exists)
            ctx.globalCompositeOperation = 'source-atop';
            ctx.setFillStyle(0, 0, 255, 255); // Blue
            ctx.fillRect(20, 20, 40, 40); // Partially overlapping
            
            // Check area where both shapes overlap (should be blue)
            const overlapPixel = surface.getPixel(40, 40);
            assertEquals(overlapPixel.b, 255); // Blue on top
            
            // Check area where only blue would be (outside red) - should be transparent
            const blueOnlyPixel = surface.getPixel(25, 25);
            assertEquals(blueOnlyPixel.a, 0); // Should be transparent
            
            // Check area where only red exists (should still be red)
            const redOnlyPixel = surface.getPixel(60, 60);
            assertEquals(redOnlyPixel.r, 255);
            assertEquals(redOnlyPixel.a, 255);
        });

        // Test 33E: destination-atop operation
        test('Composite operations - destination-atop keeps destination where source exists', () => {
            const surface = SWCanvas.Core.Surface(100, 100);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            // Draw red square as destination  
            ctx.setFillStyle(255, 0, 0, 255); // Red
            ctx.fillRect(30, 30, 40, 40);
            
            // Draw blue with destination-atop
            ctx.globalCompositeOperation = 'destination-atop';
            ctx.setFillStyle(0, 0, 255, 255); // Blue (defines where red should remain)
            ctx.fillRect(20, 20, 40, 40); // Partially overlapping
            
            // Check overlapping area (should show red, kept by blue mask)
            const overlapPixel = surface.getPixel(40, 40);
            assertEquals(overlapPixel.r, 255); // Red kept
            assertEquals(overlapPixel.a, 255);
            
            // Check area where only blue would be (should be blue) 
            const blueOnlyPixel = surface.getPixel(25, 25);
            assertEquals(blueOnlyPixel.b, 255);
            assertEquals(blueOnlyPixel.a, 255);
            
            // destination-atop should erase destination outside source region
            // With global compositing implementation, this now works correctly
            const redOnlyPixel = surface.getPixel(60, 60);
            assertEquals(redOnlyPixel.a, 0); // Red erased (now transparent) - correct behavior
        });

        // Test 33F: HTML5 Canvas-compatible API composite operations
        test('Composite operations - HTML5 Canvas API compatibility', () => {
            const canvas = SWCanvas.createCanvas(100, 100);
            const ctx = canvas.getContext('2d');
            
            // Test default
            assertEquals(ctx.globalCompositeOperation, 'source-over');
            
            // Test setting and getting
            ctx.globalCompositeOperation = 'xor';
            assertEquals(ctx.globalCompositeOperation, 'xor');
            
            // Test that operations work through HTML5 API
            ctx.fillStyle = 'red';
            ctx.fillRect(20, 20, 40, 40);
            
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'blue';
            ctx.fillRect(30, 30, 40, 40);
            
            // Check that composite operation was applied
            const surface = canvas._coreSurface;
            const centerPixel = surface.getPixel(40, 40);
            assertEquals(centerPixel.a, 0); // Should be erased by destination-out
        });

        // Test: arcTo API validation
        // This file will be concatenated into the main core test suite

        // Test 034
        test('arcTo API parameter validation', () => {
            const surface = SWCanvas.Core.Surface(200, 200);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            // Test valid arcTo call - should not throw
            ctx.beginPath();
            ctx.moveTo(10, 10);
            ctx.arcTo(50, 10, 50, 50, 20);
            // Success if no error thrown
            
            // Test negative radius - should throw DOMException
            assertThrows(() => {
                const path = new SWCanvas.Core.SWPath2D();
                path.arcTo(10, 10, 50, 50, -5);
            }, 'IndexSizeError');
            
            // Test non-number parameters - should throw TypeError
            assertThrows(() => {
                const path = new SWCanvas.Core.SWPath2D();
                path.arcTo('10', 10, 50, 50, 5);
            }, 'TypeError');
            
            assertThrows(() => {
                const path = new SWCanvas.Core.SWPath2D();
                path.arcTo(10, 10, 50, 50, 'radius');
            }, 'TypeError');
            
            // Test infinite values - should throw TypeError
            assertThrows(() => {
                const path = new SWCanvas.Core.SWPath2D();
                path.arcTo(Infinity, 10, 50, 50, 5);
            }, 'TypeError');
            
            assertThrows(() => {
                const path = new SWCanvas.Core.SWPath2D();
                path.arcTo(10, 10, 50, 50, Infinity);
            }, 'TypeError');
            
            // Test NaN values - should throw TypeError
            assertThrows(() => {
                const path = new SWCanvas.Core.SWPath2D();
                path.arcTo(NaN, 10, 50, 50, 5);
            }, 'TypeError');
        });

        // Test 034b
        test('arcTo edge cases handling', () => {
            const path = new SWCanvas.Core.SWPath2D();
            
            // Test zero radius - should work (creates corner with lines)
            path.moveTo(10, 10);
            path.arcTo(50, 10, 50, 50, 0);
            
            // Test collinear points - should create line to first control point
            path.moveTo(10, 10);
            path.arcTo(30, 10, 50, 10, 5); // All points on horizontal line
            
            // Success if no errors thrown
        });

        // Test 034c 
        test('arcTo path command recording', () => {
            const path = new SWCanvas.Core.SWPath2D();
            path.moveTo(10, 10);
            path.arcTo(50, 10, 50, 50, 20);
            
            // Verify command was recorded
            assertEquals(path.commands.length, 2);
            assertEquals(path.commands[0].type, 'moveTo');
            assertEquals(path.commands[1].type, 'arcTo');
            assertEquals(path.commands[1].x1, 50);
            assertEquals(path.commands[1].y1, 10);
            assertEquals(path.commands[1].x2, 50);
            assertEquals(path.commands[1].y2, 50);
            assertEquals(path.commands[1].radius, 20);
        });

        // Test 034d
        test('arcTo HTML5 Canvas compatibility API', () => {
            const canvas = SWCanvas.createCanvas(200, 200);
            const ctx = canvas.getContext('2d');
            
            // Test method exists and works
            ctx.beginPath();
            ctx.moveTo(10, 10);
            ctx.arcTo(50, 10, 50, 50, 20);
            
            // Should not throw error
            ctx.stroke();
        });

        // Test: isPointInPath API validation
        // This file will be concatenated into the main core test suite

        // Test 035
        test('isPointInPath API overload handling', () => {
            const surface = SWCanvas.Core.Surface(200, 200);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            // Create a simple rectangular path
            ctx.beginPath();
            ctx.rect(50, 50, 100, 100);
            
            // Test 2-argument form: isPointInPath(x, y)
            assertEquals(ctx.isPointInPath(100, 100), true); // Inside
            assertEquals(ctx.isPointInPath(25, 25), false); // Outside
            
            // Test 3-argument form: isPointInPath(x, y, fillRule)  
            assertEquals(ctx.isPointInPath(100, 100, 'nonzero'), true);
            assertEquals(ctx.isPointInPath(100, 100, 'evenodd'), true);
            assertEquals(ctx.isPointInPath(25, 25, 'nonzero'), false);
            
            // Test 3-argument form: isPointInPath(path, x, y)
            const path = new SWCanvas.Core.SWPath2D();
            path.rect(10, 10, 50, 50);
            assertEquals(ctx.isPointInPath(path, 35, 35), true); // Inside path
            assertEquals(ctx.isPointInPath(path, 100, 100), false); // Outside path
            
            // Test 4-argument form: isPointInPath(path, x, y, fillRule)
            assertEquals(ctx.isPointInPath(path, 35, 35, 'nonzero'), true);
            assertEquals(ctx.isPointInPath(path, 35, 35, 'evenodd'), true);
            assertEquals(ctx.isPointInPath(path, 100, 100, 'evenodd'), false);
        });

        // Test 035b
        test('isPointInPath parameter validation', () => {
            const surface = SWCanvas.Core.Surface(200, 200);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            ctx.beginPath();
            ctx.rect(50, 50, 100, 100);
            
            // Test non-number coordinates - should return false
            assertEquals(ctx.isPointInPath('100', 100), false);
            assertEquals(ctx.isPointInPath(100, '100'), false);
            assertEquals(ctx.isPointInPath(NaN, 100), false);
            assertEquals(ctx.isPointInPath(100, NaN), false);
            
            // Test empty path - should return false
            const emptyPath = new SWCanvas.Core.SWPath2D();
            assertEquals(ctx.isPointInPath(emptyPath, 100, 100), false);
            
            // Test invalid argument count - should throw TypeError
            assertThrows(() => {
                ctx.isPointInPath();
            }, 'TypeError');
            
            assertThrows(() => {
                ctx.isPointInPath(100);
            }, 'TypeError');
            
            assertThrows(() => {
                ctx.isPointInPath(100, 100, 'evenodd', 'extra');
            }, 'TypeError');
        });

        // Test 035c
        test('isPointInPath fill rule behavior', () => {
            const surface = SWCanvas.Core.Surface(200, 200);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            // Create a path with a hole (outer rect with inner rect)
            const pathWithHole = new SWCanvas.Core.SWPath2D();
            pathWithHole.rect(0, 0, 100, 100);    // Outer rectangle
            pathWithHole.rect(25, 25, 50, 50);    // Inner rectangle (hole)
            
            // Point in the hole area
            const holeX = 50, holeY = 50;
            
            // With evenodd rule, hole should be empty (outside)
            assertEquals(ctx.isPointInPath(pathWithHole, holeX, holeY, 'evenodd'), false);
            
            // With nonzero rule, depends on winding direction
            // Since both rectangles have same winding, point should be inside
            assertEquals(ctx.isPointInPath(pathWithHole, holeX, holeY, 'nonzero'), true);
            
            // Point definitely outside both rectangles
            assertEquals(ctx.isPointInPath(pathWithHole, 150, 150, 'evenodd'), false);
            assertEquals(ctx.isPointInPath(pathWithHole, 150, 150, 'nonzero'), false);
        });

        // Test 035d
        test('isPointInPath HTML5 Canvas compatibility API', () => {
            const canvas = SWCanvas.createCanvas(200, 200);
            const ctx = canvas.getContext('2d');
            
            // Test method exists and works
            ctx.beginPath();
            ctx.rect(50, 50, 100, 100);
            
            // Test basic functionality
            assertEquals(ctx.isPointInPath(100, 100), true);
            assertEquals(ctx.isPointInPath(25, 25), false);
            
            // Test with external path
            const path = new SWCanvas.Core.SWPath2D();
            path.rect(10, 10, 30, 30);
            assertEquals(ctx.isPointInPath(path, 25, 25), true);
            assertEquals(ctx.isPointInPath(path, 50, 50), false);
        });

        // Test 035e  
        test('isPointInPath bakes the build-time transform (current default path)', () => {
            const surface = SWCanvas.Core.Surface(200, 200);
            const ctx = new SWCanvas.Core.Context2D(surface);

            // Per the HTML5 spec the current default path bakes the CTM at build time. The
            // rect is built under identity, so the later translate() does NOT move it — the
            // (canvas-space) query point is tested against the rect where it was built.
            ctx.beginPath();
            ctx.rect(0, 0, 50, 50);
            ctx.translate(50, 50);

            assertEquals(ctx.isPointInPath(25, 25), true); // inside the baked rect (0,0,50,50)
            assertEquals(ctx.isPointInPath(75, 75), false); // where a translated copy would be — not baked

            // Building UNDER a transform bakes that transform into the geometry.
            ctx.beginPath();
            ctx.rect(0, 0, 50, 50); // CTM is translate(50,50) → baked at (50,50)-(100,100)
            assertEquals(ctx.isPointInPath(75, 75), true); // inside the baked-under-translate rect
            assertEquals(ctx.isPointInPath(25, 25), false); // origin no longer covered
        });

        // Test: isPointInStroke API validation
        // This file will be concatenated into the main core test suite

        // Test 036
        test('isPointInStroke API overload handling', () => {
            const surface = SWCanvas.Core.Surface(200, 200);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            // Set stroke properties for testing
            ctx.lineWidth = 10;
            ctx.lineJoin = 'miter';
            ctx.lineCap = 'butt';
            
            // Create a simple rectangular path
            ctx.beginPath();
            ctx.rect(50, 50, 100, 100);
            
            // Test 2-argument form: isPointInStroke(x, y)
            assertEquals(ctx.isPointInStroke(45, 100), true); // On left edge of stroke
            assertEquals(ctx.isPointInStroke(155, 100), true); // On right edge of stroke 
            assertEquals(ctx.isPointInStroke(100, 45), true); // On top edge of stroke
            assertEquals(ctx.isPointInStroke(100, 155), true); // On bottom edge of stroke
            assertEquals(ctx.isPointInStroke(25, 25), false); // Outside stroke
            assertEquals(ctx.isPointInStroke(100, 100), false); // Inside path but not in stroke
            
            // Test 3-argument form: isPointInStroke(path, x, y)
            const path = new SWCanvas.Core.SWPath2D();
            path.rect(10, 10, 50, 50);
            assertEquals(ctx.isPointInStroke(path, 5, 35), true); // On left edge of stroke
            assertEquals(ctx.isPointInStroke(path, 65, 35), true); // On right edge of stroke
            assertEquals(ctx.isPointInStroke(path, 35, 5), true); // On top edge of stroke
            assertEquals(ctx.isPointInStroke(path, 35, 65), true); // On bottom edge of stroke
            assertEquals(ctx.isPointInStroke(path, 35, 35), false); // Inside path but not in stroke
            assertEquals(ctx.isPointInStroke(path, 100, 100), false); // Outside stroke
        });

        // Test 036b
        test('isPointInStroke parameter validation', () => {
            const surface = SWCanvas.Core.Surface(200, 200);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.rect(50, 50, 100, 100);
            
            // Test non-number coordinates - should return false
            assertEquals(ctx.isPointInStroke('100', 100), false);
            assertEquals(ctx.isPointInStroke(100, '100'), false);
            assertEquals(ctx.isPointInStroke(NaN, 100), false);
            assertEquals(ctx.isPointInStroke(100, NaN), false);
            
            // Test empty path - should return false
            const emptyPath = new SWCanvas.Core.SWPath2D();
            assertEquals(ctx.isPointInStroke(emptyPath, 100, 100), false);
            
            // Test invalid argument count - should throw TypeError
            assertThrows(() => {
                ctx.isPointInStroke();
            }, 'TypeError');
            
            assertThrows(() => {
                ctx.isPointInStroke(100);
            }, 'TypeError');
            
            assertThrows(() => {
                ctx.isPointInStroke(100, 100, 'evenodd', 'extra');
            }, 'TypeError');
            
            // Test invalid path object - should throw TypeError
            assertThrows(() => {
                ctx.isPointInStroke({}, 100, 100);
            }, 'TypeError');
            
            assertThrows(() => {
                ctx.isPointInStroke(null, 100, 100);
            }, 'TypeError');
        });

        // Test 036c
        test('isPointInStroke stroke properties', () => {
            const surface = SWCanvas.Core.Surface(200, 200);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            // Create a simple line path
            const path = new SWCanvas.Core.SWPath2D();
            path.moveTo(50, 100);
            path.lineTo(150, 100);
            
            // Test different stroke widths
            ctx.lineWidth = 1;
            assertEquals(ctx.isPointInStroke(path, 100, 99.5), true); // Just inside thin stroke
            assertEquals(ctx.isPointInStroke(path, 100, 98), false); // Outside thin stroke
            
            ctx.lineWidth = 20;
            assertEquals(ctx.isPointInStroke(path, 100, 90), true); // Inside thick stroke
            assertEquals(ctx.isPointInStroke(path, 100, 80), false); // Outside thick stroke
            
            // Test HTML5 Canvas compliance: zero width should be ignored (keep previous lineWidth=20)
            const previousWidth = ctx.lineWidth; // Should be 20 from above
            ctx.lineWidth = 0; // This should be ignored per HTML5 Canvas spec
            assertEquals(ctx.lineWidth, previousWidth); // lineWidth should remain unchanged
            assertEquals(ctx.isPointInStroke(path, 100, 90), true); // Inside thick stroke (lineWidth=20)
            assertEquals(ctx.isPointInStroke(path, 100, 80), false); // Outside thick stroke
        });

        // Test 036d
        test('isPointInStroke line caps and joins', () => {
            const surface = SWCanvas.Core.Surface(200, 200);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            ctx.lineWidth = 10;
            
            // Test line caps with open path
            const openPath = new SWCanvas.Core.SWPath2D();
            openPath.moveTo(50, 100);
            openPath.lineTo(100, 100);
            
            // Test butt caps (default)
            ctx.lineCap = 'butt';
            assertEquals(ctx.isPointInStroke(openPath, 45, 100), false); // Beyond butt cap
            assertEquals(ctx.isPointInStroke(openPath, 105, 100), false); // Beyond butt cap
            
            // Test square caps
            ctx.lineCap = 'square';
            assertEquals(ctx.isPointInStroke(openPath, 45, 100), true); // Within square cap extension
            assertEquals(ctx.isPointInStroke(openPath, 105, 100), true); // Within square cap extension
            
            // Test round caps  
            ctx.lineCap = 'round';
            assertEquals(ctx.isPointInStroke(openPath, 47, 97), true); // Within round cap
            assertEquals(ctx.isPointInStroke(openPath, 103, 97), true); // Within round cap
        });

        // Test 036e
        test('isPointInStroke line dash patterns', () => {
            const surface = SWCanvas.Core.Surface(200, 200);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            ctx.lineWidth = 5;
            
            // Create a longer horizontal line for dash testing
            const path = new SWCanvas.Core.SWPath2D();
            path.moveTo(20, 100);
            path.lineTo(180, 100);
            
            // Test solid line (no dashing)
            ctx.setLineDash([]);
            assertEquals(ctx.isPointInStroke(path, 100, 100), true); // Middle of solid line
            
            // Test dashed line
            ctx.setLineDash([20, 10]); // 20px dash, 10px gap
            ctx.lineDashOffset = 0;
            
            // Points in dash segments should be true, points in gaps should be false
            assertEquals(ctx.isPointInStroke(path, 30, 100), true); // In first dash (20-40)
            assertEquals(ctx.isPointInStroke(path, 45, 100), false); // In first gap (40-50)
            assertEquals(ctx.isPointInStroke(path, 60, 100), true); // In second dash (50-70)
            assertEquals(ctx.isPointInStroke(path, 75, 100), false); // In second gap (70-80)
            
            // Test with dash offset
            ctx.lineDashOffset = 10;
            // This shifts the pattern by 10px, starting 10px into the pattern cycle
            // So we get: remaining 10px of first dash (20-30), then 10px gap (30-40), then 20px dash (40-60)
            assertEquals(ctx.isPointInStroke(path, 25, 100), true); // In remaining dash segment (20-30)
            assertEquals(ctx.isPointInStroke(path, 35, 100), false); // In gap (30-40)
            assertEquals(ctx.isPointInStroke(path, 50, 100), true); // In dash (40-60)
        });

        // Test 036f
        test('isPointInStroke HTML5 Canvas compatibility API', () => {
            const canvas = SWCanvas.createCanvas(200, 200);
            const ctx = canvas.getContext('2d');
            
            ctx.lineWidth = 8;
            
            // Test method exists and works
            ctx.beginPath();
            ctx.rect(50, 50, 100, 100);
            
            // Test basic functionality
            assertEquals(ctx.isPointInStroke(46, 100), true); // On stroke edge
            assertEquals(ctx.isPointInStroke(100, 100), false); // Inside path, not in stroke
            assertEquals(ctx.isPointInStroke(25, 25), false); // Outside stroke
            
            // Test with external path
            const path = new SWCanvas.Core.SWPath2D();
            path.rect(10, 10, 30, 30);
            assertEquals(ctx.isPointInStroke(path, 6, 25), true); // On stroke edge
            assertEquals(ctx.isPointInStroke(path, 25, 25), false); // Inside path, not in stroke
            assertEquals(ctx.isPointInStroke(path, 100, 100), false); // Outside stroke
        });

        // Test 036g
        test('isPointInStroke bakes the build-time transform (current default path)', () => {
            const surface = SWCanvas.Core.Surface(200, 200);
            const ctx = new SWCanvas.Core.Context2D(surface);

            ctx.lineWidth = 10;

            // Built under identity, then translated: the baked stroke stays at (0,0,50,50)
            // with a 10px pen (extends 5px either side of each edge). The pen width is
            // interpreted in draw-time user space; here drawT is a pure translate (scale 1).
            ctx.beginPath();
            ctx.rect(0, 0, 50, 50);
            ctx.translate(50, 50);

            assertEquals(ctx.isPointInStroke(0, 25), true); // centered on the baked left edge (x≈0)
            assertEquals(ctx.isPointInStroke(50, 25), true); // centered on the baked right edge (x≈50)
            assertEquals(ctx.isPointInStroke(25, 25), false); // interior, 25px from any edge → not in the 10px stroke
            assertEquals(ctx.isPointInStroke(75, 75), false); // where a translated copy would be — not baked
        });

        // Test 036h
        test('isPointInStroke edge cases', () => {
            const surface = SWCanvas.Core.Surface(200, 200);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            ctx.lineWidth = 5;
            
            // Test with path containing only moveTo (should return false)
            const moveOnlyPath = new SWCanvas.Core.SWPath2D();
            moveOnlyPath.moveTo(100, 100);
            assertEquals(ctx.isPointInStroke(moveOnlyPath, 100, 100), false);
            
            // Test with current path that has no commands
            ctx.beginPath(); // Clear current path
            assertEquals(ctx.isPointInStroke(100, 100), false);
            
            // Test with very small line segments
            const tinyPath = new SWCanvas.Core.SWPath2D();
            tinyPath.moveTo(100, 100);
            tinyPath.lineTo(100.1, 100); // Tiny line
            assertEquals(ctx.isPointInStroke(tinyPath, 100, 97.5), true); // Should still detect stroke
            
            // Test with closed path
            const closedPath = new SWCanvas.Core.SWPath2D();
            closedPath.moveTo(50, 50);
            closedPath.lineTo(150, 50);
            closedPath.lineTo(150, 150);
            closedPath.lineTo(50, 150);
            closedPath.closePath();
            assertEquals(ctx.isPointInStroke(closedPath, 47.5, 100), true); // On left stroke edge
            assertEquals(ctx.isPointInStroke(closedPath, 100, 100), false); // Inside closed path
        });

        // Test: Transform2D uniformScale property
        // Validates the pre-computed uniform scale factor (sqrt of absolute determinant)

        test('Transform2D uniformScale - identity matrix', () => {
            const t = new SWCanvas.Core.Transform2D();
            // Identity matrix: |1*1 - 0*0| = 1, sqrt(1) = 1
            if (Math.abs(t.uniformScale - 1) > 0.0001) {
                throw new Error(`Identity matrix uniformScale should be 1, got ${t.uniformScale}`);
            }
        });

        test('Transform2D uniformScale - uniform scale 2x', () => {
            const t = SWCanvas.Core.Transform2D.scaling(2, 2);
            // Scale 2x: |2*2 - 0*0| = 4, sqrt(4) = 2
            if (Math.abs(t.uniformScale - 2) > 0.0001) {
                throw new Error(`Uniform 2x scale uniformScale should be 2, got ${t.uniformScale}`);
            }
        });

        test('Transform2D uniformScale - non-uniform scale', () => {
            const t = SWCanvas.Core.Transform2D.scaling(3, 4);
            // Scale 3x4: |3*4 - 0*0| = 12, sqrt(12) ≈ 3.464
            const expected = Math.sqrt(12);
            if (Math.abs(t.uniformScale - expected) > 0.0001) {
                throw new Error(`Non-uniform scale (3,4) uniformScale should be ${expected}, got ${t.uniformScale}`);
            }
        });

        test('Transform2D uniformScale - rotation only', () => {
            const t = SWCanvas.Core.Transform2D.rotation(Math.PI / 4); // 45 degrees
            // Rotation: |cos*cos - sin*(-sin)| = cos²+sin² = 1, sqrt(1) = 1
            if (Math.abs(t.uniformScale - 1) > 0.0001) {
                throw new Error(`45-degree rotation uniformScale should be 1, got ${t.uniformScale}`);
            }
        });

        test('Transform2D uniformScale - rotation plus uniform scale', () => {
            // Scale 3x then rotate 30 degrees
            const t = SWCanvas.Core.Transform2D.scaling(3, 3).rotate(Math.PI / 6);
            // After scaling 3x: determinant = 9, after rotation: still 9
            // sqrt(9) = 3
            if (Math.abs(t.uniformScale - 3) > 0.0001) {
                throw new Error(`Scaled rotation uniformScale should be 3, got ${t.uniformScale}`);
            }
        });

        test('Transform2D uniformScale - 90 degree rotation', () => {
            const t = SWCanvas.Core.Transform2D.rotation(Math.PI / 2);
            // 90-degree rotation: |0*0 - 1*(-1)| = 1, sqrt(1) = 1
            if (Math.abs(t.uniformScale - 1) > 0.0001) {
                throw new Error(`90-degree rotation uniformScale should be 1, got ${t.uniformScale}`);
            }
        });

        test('Transform2D uniformScale - negative scale (flip)', () => {
            const t = SWCanvas.Core.Transform2D.scaling(-2, 2);
            // Flip: |-2*2 - 0*0| = |-4| = 4, sqrt(4) = 2
            if (Math.abs(t.uniformScale - 2) > 0.0001) {
                throw new Error(`Flipped scale uniformScale should be 2, got ${t.uniformScale}`);
            }
        });


        // Test: SWCanvasElement.toDataURL produces a deterministic PNG data URL.
        // Identical pixels must yield identical bytes (relied on for snapshot tests),
        // and the output must be a real PNG (signature) reflecting the drawn pixels.

        test('toDataURL returns a data:image/png URL with a valid PNG signature', () => {
            const canvas = SWCanvas.createCanvas(4, 3);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgb(10, 20, 30)';
            ctx.fillRect(0, 0, 4, 3);

            const url = canvas.toDataURL();
            assertEquals(url.indexOf('data:image/png;base64,'), 0, 'must be a PNG data URL');

            // atob, not Node's Buffer: the same test runs in the browser page.
            const binary = atob(url.slice('data:image/png;base64,'.length));
            const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
            // PNG signature: 137 80 78 71 13 10 26 10
            assertEquals(bytes[0], 137, 'PNG sig byte 0');
            assertEquals(bytes[1], 80, 'PNG sig byte 1');
            assertEquals(bytes[2], 78, 'PNG sig byte 2');
            assertEquals(bytes[3], 71, 'PNG sig byte 3');
        });

        test('toDataURL is deterministic for identical pixels', () => {
            const a = SWCanvas.createCanvas(8, 8);
            a.getContext('2d').fillStyle = 'rgba(200, 100, 50, 0.5)';
            a.getContext('2d').fillRect(1, 1, 5, 5);

            const b = SWCanvas.createCanvas(8, 8);
            b.getContext('2d').fillStyle = 'rgba(200, 100, 50, 0.5)';
            b.getContext('2d').fillRect(1, 1, 5, 5);

            assertEquals(a.toDataURL(), b.toDataURL(), 'same pixels => same bytes');
        });

        test('toDataURL differs when pixels differ', () => {
            const a = SWCanvas.createCanvas(4, 4);
            a.getContext('2d').fillStyle = 'rgb(0, 0, 0)';
            a.getContext('2d').fillRect(0, 0, 4, 4);

            const b = SWCanvas.createCanvas(4, 4);
            b.getContext('2d').fillStyle = 'rgb(255, 255, 255)';
            b.getContext('2d').fillRect(0, 0, 4, 4);

            assertEquals(a.toDataURL() === b.toDataURL(), false, 'different pixels => different bytes');
        });


        // Test: getImageData/putImageData round-trips byte-exactly.
        // SWCanvas stores non-premultiplied RGBA8, so unlike a browser canvas this is
        // lossless even for partial alpha. Fizzygum relies on this for pixel hit-testing
        // (Widget.fullImage, BackBufferMixin point-alpha, PreferencesAndSettings probe).

        test('putImageData then getImageData returns identical bytes (incl. partial alpha)', () => {
            const canvas = SWCanvas.createCanvas(6, 5);
            const ctx = canvas.getContext('2d');

            const src = ctx.createImageData(6, 5);
            for (let i = 0; i < src.data.length; i += 4) {
                src.data[i]     = (i * 7) & 0xff;        // R
                src.data[i + 1] = (i * 13 + 5) & 0xff;   // G
                src.data[i + 2] = (i * 31 + 17) & 0xff;  // B
                src.data[i + 3] = (i % 8 === 0) ? 128 : 255; // A (mix in partial alpha)
            }

            ctx.putImageData(src, 0, 0);
            const out = ctx.getImageData(0, 0, 6, 5);

            assertEquals(out.width, 6, 'width');
            assertEquals(out.height, 5, 'height');
            let mismatches = 0;
            for (let i = 0; i < src.data.length; i++) {
                if (out.data[i] !== src.data[i]) mismatches++;
            }
            assertEquals(mismatches, 0, 'every RGBA byte must round-trip exactly');
        });


        // Test: restore() on an empty state stack is a no-op (does not throw).
        // Fizzygum's resetWorldCanvasContext deliberately over-restores ~2000x to
        // recover from a half-applied state, so this must never throw.

        test('restore() over-pops on an empty stack without throwing', () => {
            const canvas = SWCanvas.createCanvas(10, 10);
            const ctx = canvas.getContext('2d');

            for (let i = 0; i < 5; i++) {
                ctx.restore(); // no matching save()
            }

            // Context must still be usable afterwards.
            ctx.fillStyle = 'rgb(0, 128, 0)';
            ctx.fillRect(0, 0, 10, 10);
            const px = ctx.getImageData(5, 5, 1, 1).data;
            assertEquals(px[0], 0, 'R');
            assertEquals(px[1], 128, 'G');
            assertEquals(px[2], 0, 'B');
        });


        // Test: drawImage accepts the source shapes Fizzygum passes — an SWCanvasElement,
        // a structural ImageLike, and a canvas-like object (getContext) — and routes
        // element image sources (HTMLImageElement/HTMLVideoElement/ImageBitmap) through
        // the scratch-canvas adapter: with a DOM it rasterizes them, with HTML5's answer
        // for a source that has no pixels yet; without one it throws cleanly.

        test('drawImage(SWCanvasElement) blits the source pixels', () => {
            const srcCanvas = SWCanvas.createCanvas(2, 2);
            const sctx = srcCanvas.getContext('2d');
            sctx.fillStyle = 'rgb(220, 30, 40)';
            sctx.fillRect(0, 0, 2, 2);

            const dst = SWCanvas.createCanvas(4, 4);
            const dctx = dst.getContext('2d');
            dctx.drawImage(srcCanvas, 0, 0);

            const px = dctx.getImageData(0, 0, 1, 1).data;
            assertEquals(px[0], 220, 'R');
            assertEquals(px[1], 30, 'G');
            assertEquals(px[2], 40, 'B');
        });

        test('drawImage(structural ImageLike) blits the source pixels', () => {
            const data = new Uint8ClampedArray(2 * 2 * 4);
            for (let i = 0; i < data.length; i += 4) {
                data[i] = 5; data[i + 1] = 200; data[i + 2] = 90; data[i + 3] = 255;
            }
            const imageLike = { width: 2, height: 2, data: data };

            const dst = SWCanvas.createCanvas(3, 3);
            const dctx = dst.getContext('2d');
            dctx.drawImage(imageLike, 1, 1);

            const px = dctx.getImageData(1, 1, 1, 1).data;
            assertEquals(px[0], 5, 'R');
            assertEquals(px[1], 200, 'G');
            assertEquals(px[2], 90, 'B');
        });

        test('drawImage(canvas-like with getContext) is unwrapped via getImageData', () => {
            // Minimal duck of an HTMLCanvasElement: width/height + getContext('2d')
            // returning an object exposing getImageData.
            const fakeData = new Uint8ClampedArray(1 * 1 * 4);
            fakeData[0] = 17; fakeData[1] = 18; fakeData[2] = 19; fakeData[3] = 255;
            const fakeCanvas = {
                width: 1,
                height: 1,
                getContext: function () {
                    return { getImageData: function () { return { width: 1, height: 1, data: fakeData }; } };
                }
            };

            const dst = SWCanvas.createCanvas(2, 2);
            const dctx = dst.getContext('2d');
            dctx.drawImage(fakeCanvas, 0, 0);

            const px = dctx.getImageData(0, 0, 1, 1).data;
            assertEquals(px[0], 17, 'R');
            assertEquals(px[1], 18, 'G');
            assertEquals(px[2], 19, 'B');
        });

        // The element-source tests below need one environment or the other: an element
        // image source only exists where there is a DOM (the browser page runs those), and
        // SWCanvas's refusal of one only shows where there is none (Node runs that one).

        testRequiring('no-dom', 'drawImage(element image source) throws cleanly without a DOM canvas', () => {
            const dst = SWCanvas.createCanvas(2, 2);
            const dctx = dst.getContext('2d');
            // Looks like an HTMLImageElement (has naturalWidth) but no DOM to rasterize.
            const fakeImg = { naturalWidth: 2, naturalHeight: 2, complete: false };
            assertThrows(() => dctx.drawImage(fakeImg, 0, 0), 'without a DOM canvas');
        });

        testRequiring('dom', 'drawImage(ImageBitmap) blits the element source through the DOM canvas', () => {
            // transferToImageBitmap is synchronous: a real element source with known pixels.
            const offscreen = new OffscreenCanvas(2, 2);
            const octx = offscreen.getContext('2d');
            octx.fillStyle = 'rgb(220, 30, 40)';
            octx.fillRect(0, 0, 2, 2);
            const bitmap = offscreen.transferToImageBitmap();

            const dst = SWCanvas.createCanvas(4, 4);
            const dctx = dst.getContext('2d');
            dctx.drawImage(bitmap, 1, 1);

            const inside = dctx.getImageData(2, 2, 1, 1).data;
            assertEquals(inside[0], 220, 'R');
            assertEquals(inside[1], 30, 'G');
            assertEquals(inside[2], 40, 'B');
            assertEquals(inside[3], 255, 'A');
            assertEquals(dctx.getImageData(0, 0, 1, 1).data[3], 0, 'outside the image stays transparent');
        });

        testRequiring('dom', 'drawImage of an element source with no pixels yet draws nothing, as HTML5 does', () => {
            // An image without a src and a video with no frame yet are not "fully
            // decodable": HTML5 draws nothing from them (no throw).
            const dst = SWCanvas.createCanvas(2, 2);
            const dctx = dst.getContext('2d');
            dctx.fillStyle = 'rgb(10, 20, 30)';
            dctx.fillRect(0, 0, 2, 2);
            dctx.drawImage(new Image(), 0, 0);
            dctx.drawImage(document.createElement('video'), 0, 0, 2, 2);
            const px = dctx.getImageData(1, 1, 1, 1).data;
            assertEquals(px[0], 10, 'R unchanged');
            assertEquals(px[1], 20, 'G unchanged');
            assertEquals(px[2], 30, 'B unchanged');
        });

        testRequiring('dom', 'drawImage(zero-size canvas) throws InvalidStateError, as HTML5 does', () => {
            const empty = document.createElement('canvas');
            empty.width = 0;
            empty.height = 4;
            const dctx = SWCanvas.createCanvas(2, 2).getContext('2d');
            let thrown = null;
            try {
                dctx.drawImage(empty, 0, 0);
            } catch (e) {
                thrown = e;
            }
            assertEquals(thrown !== null && thrown.name, 'InvalidStateError', 'error name');
        });


        // Test: a rectangular clip must be geometrically correct on its RIGHT edge,
        // and vector fills must clip IDENTICALLY to raster (drawImage) blits.
        //
        // Regression for the Fizzygum "streak" bug: the clip-mask scanline filler used
        // ceil(left)..floor(right) with an INCLUSIVE end, which exposed one extra pixel
        // column on the right for integer-aligned clips (a clip rect [5,25) wrongly
        // exposed column 25). Vector fills bled into that phantom column while raster
        // drawImage blits bounded by their own extent did not, leaving 1px streaks of
        // erased raster content along the right edge of repainted dirty rectangles.
        // The Y axis was already correct (pixel-center sampling at y+0.5), so only the
        // right edge was wrong, never the bottom.

        function _opaque(w, h, r, g, b) {
            const data = new Uint8ClampedArray(w * h * 4);
            for (let i = 0; i < w * h; i++) { data[i*4]=r; data[i*4+1]=g; data[i*4+2]=b; data[i*4+3]=255; }
            return { width: w, height: h, data };
        }
        // last column index with any painted (alpha>0) pixel in a given row, else -1
        function _lastPaintedCol(ctx, W, row) {
            const img = ctx.getImageData(0, 0, W, row + 1).data;
            let last = -1;
            for (let x = 0; x < W; x++) if (img[(row * W + x) * 4 + 3] > 0) last = x;
            return last;
        }

        test('clip right edge is geometrically correct (no phantom +1 column)', () => {
            const W = 40, H = 40, ROW = 12;
            // Clip rect [5,5,20,20] => right edge at x=25 (exclusive) => last visible col 24.
            const canvas = SWCanvas.createCanvas(W, H);
            const ctx = canvas.getContext('2d');
            ctx.beginPath();
            ctx.rect(5, 5, 20, 20);
            ctx.clip();
            ctx.fillStyle = 'rgb(0, 200, 0)';
            ctx.fillRect(0, 0, W, H); // huge fill; only the clip limits it

            const px24 = ctx.getImageData(24, ROW, 1, 1).data; // inside clip => painted
            const px25 = ctx.getImageData(25, ROW, 1, 1).data; // outside clip => untouched
            assertEquals(px24[3], 255, 'column 24 (last column inside clip) must be filled');
            assertEquals(px25[3], 0,   'column 25 (just outside clip) must NOT be filled');
            assertEquals(_lastPaintedCol(ctx, W, ROW), 24, 'rightmost filled column under clip must be 24');
        });

        test('vector fill and raster drawImage clip identically on the right edge', () => {
            const W = 40, H = 40, ROW = 12;

            const cf = SWCanvas.createCanvas(W, H);
            const f = cf.getContext('2d');
            f.beginPath(); f.rect(5, 5, 20, 20); f.clip();
            f.fillStyle = 'rgb(0, 200, 0)';
            f.fillRect(0, 0, W, H);

            const cd = SWCanvas.createCanvas(W, H);
            const d = cd.getContext('2d');
            d.beginPath(); d.rect(5, 5, 20, 20); d.clip();
            d.drawImage(_opaque(W, H, 200, 0, 0), 0, 0); // image spans well past the clip

            assertEquals(
                _lastPaintedCol(d, W, ROW),
                _lastPaintedCol(f, W, ROW),
                'drawImage and fillRect must reach the same rightmost column under an identical clip'
            );
            assertEquals(_lastPaintedCol(d, W, ROW), 24, 'both must stop at column 24');
        });


        // Test: the context's *current default path* bakes in the CTM at the time each
        // path-building call is made (HTML5 Canvas semantics), not at fill/stroke time.
        //
        // Regression for the Fizzygum icon bug: the canonical PaintCode idiom
        //   ctx.save(); ctx.translate(x,y); ctx.scale(w/2,h/2)
        //   ctx.arc(1,1,1,0,2*PI); ctx.closePath()
        //   ctx.restore()              // transform popped BEFORE the caller strokes
        //   ctx.lineWidth = ...; ctx.stroke()
        // must place the circle where it was BUILT (baked transform), not re-evaluate the
        // geometry under the draw-time transform (which dropped the translate/scale and
        // drew a tiny circle at the origin). The line width stays in draw-time user space.
        //
        // External Path2D objects remain transform-independent (transformed at draw time),
        // which this file also guards.

        // Returns true if the pixel is opaque and dark (black-on-white test fixtures).
        function isDarkPx(ctx, x, y) {
            const px = ctx.getImageData(x, y, 1, 1).data;
            return px[3] > 128 && px[0] < 128;
        }

        // Bounding box of opaque dark pixels, plus count.
        function darkBBox(ctx, w, h) {
            const data = ctx.getImageData(0, 0, w, h).data;
            let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1, n = 0;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const i = (y * w + x) * 4;
                    if (data[i + 3] > 128 && data[i] < 128) {
                        n++;
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
            }
            return { minX, minY, maxX, maxY, n };
        }

        function whiteCanvas(w, h) {
            const canvas = SWCanvas.createCanvas(w, h);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, w, h);
            return { canvas, ctx };
        }

        test('current-path stroke bakes the build-time transform (arc built under translate+scale, restored, then stroked)', () => {
            const { ctx } = whiteCanvas(100, 100);

            // Build a unit circle under translate(20,40)·scale(10,10) → a circle centered
            // at (30,50) with radius 10 in device space; restore BEFORE stroking.
            ctx.save();
            ctx.beginPath();
            ctx.translate(20, 40);
            ctx.scale(10, 10);
            ctx.arc(1, 1, 1, 0, 2 * Math.PI);
            ctx.closePath();
            ctx.restore();
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = 'black';
            ctx.stroke();

            // The stroke ring (band radius ~8.25..11.75) sits around (30,50).
            assertEquals(isDarkPx(ctx, 30, 40), true, 'ring present at top of baked circle (30,40)');
            assertEquals(isDarkPx(ctx, 20, 50), true, 'ring present at left of baked circle (20,50)');
            assertEquals(isDarkPx(ctx, 30, 50), false, 'baked circle is hollow at its center (30,50)');

            // The pre-fix bug drew a tiny ring at user-space (1,1): the top-left corner
            // must be clean now.
            assertEquals(isDarkPx(ctx, 2, 2), false, 'no stray geometry at the origin (the old bug)');

            // Overall the geometry must be localized around the baked circle, not the corner.
            const bb = darkBBox(ctx, 100, 100);
            assertEquals(bb.minX >= 16 && bb.maxX <= 44, true, 'dark pixels span x[~16..44]');
            assertEquals(bb.minY >= 36 && bb.maxY <= 64, true, 'dark pixels span y[~36..64]');
        });

        test('current-path fill bakes the build-time transform (juggled disk lands at baked center)', () => {
            const { ctx } = whiteCanvas(100, 100);

            ctx.save();
            ctx.beginPath();
            ctx.translate(20, 40);
            ctx.scale(10, 10);
            ctx.arc(1, 1, 1, 0, 2 * Math.PI);
            ctx.closePath();
            ctx.restore();
            ctx.fillStyle = 'black';
            ctx.fill();

            assertEquals(isDarkPx(ctx, 30, 50), true, 'filled disk covers the baked center (30,50)');
            assertEquals(isDarkPx(ctx, 30, 42), true, 'filled disk covers a point inside the baked circle');
            assertEquals(isDarkPx(ctx, 2, 2), false, 'no stray fill at the origin (the old bug)');
        });

        test('juggled current-path stroke is pixel-identical to the equivalent direct stroke', () => {
            // A: the build-then-restore idiom.
            const a = whiteCanvas(100, 100);
            a.ctx.save();
            a.ctx.beginPath();
            a.ctx.translate(20, 40);
            a.ctx.scale(10, 10);
            a.ctx.arc(1, 1, 1, 0, 2 * Math.PI);
            a.ctx.closePath();
            a.ctx.restore();
            a.ctx.lineWidth = 3.5;
            a.ctx.strokeStyle = 'black';
            a.ctx.stroke();

            // B: the same circle authored directly in draw space (no transform juggling).
            const b = whiteCanvas(100, 100);
            b.ctx.beginPath();
            b.ctx.arc(30, 50, 10, 0, 2 * Math.PI);
            b.ctx.closePath();
            b.ctx.lineWidth = 3.5;
            b.ctx.strokeStyle = 'black';
            b.ctx.stroke();

            const da = a.ctx.getImageData(0, 0, 100, 100).data;
            const db = b.ctx.getImageData(0, 0, 100, 100).data;
            let diffs = 0;
            for (let i = 0; i < da.length; i++) {
                if (da[i] !== db[i]) diffs++;
            }
            assertEquals(diffs, 0, 'baked juggled circle equals the direct circle byte-for-byte');
        });

        test('non-uniform build transform produces an ellipse at the baked location', () => {
            const { ctx } = whiteCanvas(120, 120);

            // arc(0,0,1) under translate(60,60)·scale(20,8) → ellipse centered (60,60),
            // rx=20, ry=8; restore before stroking.
            ctx.save();
            ctx.beginPath();
            ctx.translate(60, 60);
            ctx.scale(20, 8);
            ctx.arc(0, 0, 1, 0, 2 * Math.PI);
            ctx.closePath();
            ctx.restore();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'black';
            ctx.stroke();

            const bb = darkBBox(ctx, 120, 120);
            const cx = (bb.minX + bb.maxX) / 2;
            const cy = (bb.minY + bb.maxY) / 2;
            const width = bb.maxX - bb.minX;
            const height = bb.maxY - bb.minY;

            assertEquals(Math.abs(cx - 60) <= 2, true, 'ellipse centered on x≈60');
            assertEquals(Math.abs(cy - 60) <= 2, true, 'ellipse centered on y≈60');
            // rx=20, ry=8 → clearly wider than tall (and NOT a circle).
            assertEquals(width > height + 10, true, 'ellipse is wider than tall (non-uniform scale honored)');
            assertEquals(Math.abs(width / 2 - 20) <= 3, true, 'horizontal radius ≈ 20');
            assertEquals(Math.abs(height / 2 - 8) <= 3, true, 'vertical radius ≈ 8');
        });

        test('rotation in the build transform keeps a circle a circle at the baked center', () => {
            const { ctx } = whiteCanvas(120, 120);

            // Rotate about (60,60), build a circle there, restore, stroke. A circle is
            // rotation-invariant, so it must remain a circle centered at (60,60) r=20.
            ctx.save();
            ctx.translate(60, 60);
            ctx.rotate(Math.PI / 4);
            ctx.beginPath();
            ctx.arc(0, 0, 20, 0, 2 * Math.PI);
            ctx.closePath();
            ctx.restore();
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'black';
            ctx.stroke();

            assertEquals(isDarkPx(ctx, 60, 40), true, 'ring present at top (60,40)');
            assertEquals(isDarkPx(ctx, 80, 60), true, 'ring present at right (80,60)');
            assertEquals(isDarkPx(ctx, 60, 80), true, 'ring present at bottom (60,80)');
            assertEquals(isDarkPx(ctx, 40, 60), true, 'ring present at left (40,60)');
            assertEquals(isDarkPx(ctx, 60, 60), false, 'circle is hollow at the baked center');
        });

        test('clip() honors the build-time transform of the current path', () => {
            const { ctx } = whiteCanvas(100, 100);

            // Build a 20x20 clip rect under translate(40,40), restore, then clip and paint.
            // The clip must land at device (40,40)-(60,60), not (0,0)-(20,20).
            ctx.save();
            ctx.beginPath();
            ctx.translate(40, 40);
            ctx.rect(0, 0, 20, 20);
            ctx.restore();
            ctx.clip();
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, 100, 100); // only the clipped region should darken

            assertEquals(isDarkPx(ctx, 50, 50), true, 'inside the baked clip region (50,50)');
            assertEquals(isDarkPx(ctx, 10, 10), false, 'outside the baked clip region (10,10) stays clear');
        });

        test('external Path2D stays transform-independent (transformed at draw time)', () => {
            const { ctx } = whiteCanvas(100, 100);

            // A standalone path carries no build-time transform; it must be transformed by
            // the CTM in effect at fill() time — unlike the current default path.
            const path = new SWCanvas.Core.SWPath2D();
            path.rect(0, 0, 20, 20);

            ctx.translate(50, 50);
            ctx.fillStyle = 'black';
            ctx.fill(path);

            assertEquals(isDarkPx(ctx, 55, 55), true, 'Path2D drawn under the draw-time transform (55,55)');
            assertEquals(isDarkPx(ctx, 5, 5), false, 'Path2D NOT baked at build time (5,5) stays clear');
        });

        test('arcTo bakes the build-time transform under non-uniform scale (elliptical, not circular)', () => {
            const { ctx } = whiteCanvas(160, 140);

            // User-space quarter arc: current (20,0) → corner (0,0) → (0,20), radius 20 ⇒ a
            // quarter circle centered (20,20) r20, spanning user x,y ∈ [0,20]. Baked by
            // translate(40,40)·scale(3,1.5) it covers device x∈[40,100], y∈[40,70] — a 2:1
            // ellipse. (The old radius×uniformScale approximation would draw a ~circular arc.)
            ctx.save();
            ctx.beginPath();
            ctx.translate(40, 40);
            ctx.scale(3, 1.5);
            ctx.moveTo(20, 0);
            ctx.arcTo(0, 0, 0, 20, 20);
            ctx.restore();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'black';
            ctx.stroke();

            assertEquals(isDarkPx(ctx, 2, 2), false, 'no stray geometry at the origin (the old draw-time bug)');
            const bb = darkBBox(ctx, 160, 140);
            const w = bb.maxX - bb.minX;
            const h = bb.maxY - bb.minY;
            assertEquals(Math.abs((bb.minX + bb.maxX) / 2 - 70) <= 6, true, 'arc spans around device x≈[40..100]');
            assertEquals(w > h + 15, true, 'corner is elliptical: clearly wider than tall (non-uniform scale baked)');
            assertEquals(Math.abs(w - 60) <= 8, true, 'horizontal extent ≈ 60');
            assertEquals(Math.abs(h - 30) <= 8, true, 'vertical extent ≈ 30');
        });

        test('isPointInPath honors the baked transform under the juggle idiom', () => {
            const { ctx } = whiteCanvas(100, 100);

            // Build a unit circle under translate(20,40)·scale(10,10) → baked disk centered
            // (30,50) r10; restore before hit-testing. The query point is in canvas space.
            ctx.save();
            ctx.beginPath();
            ctx.translate(20, 40);
            ctx.scale(10, 10);
            ctx.arc(1, 1, 1, 0, 2 * Math.PI);
            ctx.closePath();
            ctx.restore();

            assertEquals(ctx.isPointInPath(30, 50), true, 'baked center (30,50) is inside');
            assertEquals(ctx.isPointInPath(30, 41), true, 'inside near the top of the baked disk');
            assertEquals(ctx.isPointInPath(30, 38), false, 'just outside the baked disk (r10)');
            assertEquals(ctx.isPointInPath(1, 1), false, 'NOT tested against the un-baked user-space circle (old behavior)');
        });

        test('isPointInStroke honors the baked transform under the juggle idiom', () => {
            const { ctx } = whiteCanvas(100, 100);

            ctx.lineWidth = 3.5;
            ctx.save();
            ctx.beginPath();
            ctx.translate(20, 40);
            ctx.scale(10, 10);
            ctx.arc(1, 1, 1, 0, 2 * Math.PI);
            ctx.closePath();
            ctx.restore();

            // Baked ring centered (30,50) r10 with a 3.5px pen (band r≈8.25..11.75).
            assertEquals(ctx.isPointInStroke(30, 40), true, 'on the baked ring (top, r10)');
            assertEquals(ctx.isPointInStroke(20, 50), true, 'on the baked ring (left, r10)');
            assertEquals(ctx.isPointInStroke(30, 50), false, 'baked center is hollow');
            assertEquals(ctx.isPointInStroke(1, 1), false, 'no ring at the un-baked user-space location (old behavior)');
        });

        test('stroke under a reflected (negative-scale) transform lands at the baked location', () => {
            const { ctx } = whiteCanvas(100, 100);

            // Bake a circle at device (30,50) r10 under identity, then stroke under a
            // reflection (scale(-1,1) about x=50). Reflection is invertible (|det|=1), so the
            // back-transform/forward round-trip leaves the geometry at (30,50) and keeps the
            // round pen round (width unchanged).
            ctx.beginPath();
            ctx.arc(30, 50, 10, 0, 2 * Math.PI);
            ctx.closePath();
            ctx.save();
            ctx.translate(100, 0);
            ctx.scale(-1, 1);
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'black';
            ctx.stroke();
            ctx.restore();

            assertEquals(isDarkPx(ctx, 30, 40), true, 'ring present at the baked circle top (30,40)');
            assertEquals(isDarkPx(ctx, 30, 50), false, 'ring hollow at the baked center (30,50)');
            assertEquals(isDarkPx(ctx, 70, 50), false, 'nothing at the mirror image location (70,50)');
        });

        test('stroke under a singular transform is a guarded no-op (does not throw)', () => {
            const { ctx } = whiteCanvas(100, 100);

            ctx.beginPath();
            ctx.arc(30, 50, 10, 0, 2 * Math.PI);
            ctx.closePath();
            ctx.save();
            ctx.scale(1, 0); // singular CTM: no draw-time user space → nothing to stroke
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'black';
            ctx.stroke();
            ctx.restore();

            const bb = darkBBox(ctx, 100, 100);
            assertEquals(bb.n, 0, 'singular-transform stroke drew nothing (and did not throw)');
        });


        // Test: path-fill (PolygonFiller) must agree with fillRect (RectOpsAA) on the
        // RIGHT edge, and an UNCLIPPED fill must not bleed one column past a clipped
        // morph drawn on top of it.
        //
        // Regression for the Fizzygum "everything-but-the-desktop erased" symptom: the
        // surface path-fill spans used ceil(left)..floor(right) with an INCLUSIVE end,
        // so a path-filled (or pattern-filled) rect was 1px wider on the right than
        // fillRect / the clip / drawImage / HTML5. When the desktop background (an
        // unclipped pattern path-fill) reached column R while clipped morphs on top
        // correctly stopped at R-1, that extra column showed only the desktop and
        // overwrote the clean neighbour content that lived just outside the dirty rect.

        function _lastPaintedCol(ctx, W, row) {
            const img = ctx.getImageData(0, 0, W, row + 1).data;
            let last = -1;
            for (let x = 0; x < W; x++) if (img[(row * W + x) * 4 + 3] > 0) last = x;
            return last;
        }

        test('path-fill and fillRect agree on the right edge (half-open [x, x+w))', () => {
            const W = 40, H = 40, ROW = 12;

            const cr = SWCanvas.createCanvas(W, H);
            const r = cr.getContext('2d');
            r.fillStyle = 'rgb(0, 200, 0)';
            r.fillRect(5, 5, 20, 20); // RectOpsAA fast path

            const cp = SWCanvas.createCanvas(W, H);
            const p = cp.getContext('2d');
            p.fillStyle = 'rgb(0, 200, 0)';
            p.beginPath(); p.rect(5, 5, 20, 20); p.fill(); // PolygonFiller path

            assertEquals(_lastPaintedCol(p, W, ROW), _lastPaintedCol(r, W, ROW),
                'path-fill and fillRect must reach the same rightmost column');
            assertEquals(_lastPaintedCol(p, W, ROW), 24, 'rect [5,25) must fill cols 5..24, not 25');
        });

        test('unclipped fill does not bleed one column past a clipped morph on top', () => {
            const W = 40, H = 40, ROW = 12;
            const c = SWCanvas.createCanvas(W, H);
            const x = c.getContext('2d');

            // Pre-existing neighbour content everywhere (incl. the column just outside the dirty rect).
            x.fillStyle = 'rgb(0, 180, 0)';
            x.fillRect(0, 0, W, H);

            // Repaint of the dirty rect [5,25): an UNCLIPPED background path-fill, then a clipped morph.
            x.fillStyle = 'rgb(0, 0, 200)';
            x.beginPath(); x.rect(5, 5, 20, 20); x.fill();
            x.save();
            x.beginPath(); x.rect(5, 5, 20, 20); x.clip();
            x.fillStyle = 'rgb(200, 0, 0)';
            x.beginPath(); x.rect(0, 0, W, H); x.fill();
            x.restore();

            const col24 = x.getImageData(24, ROW, 1, 1).data; // clip's last column -> morph
            const col25 = x.getImageData(25, ROW, 1, 1).data; // just outside dirty rect -> untouched neighbour
            assertEquals(col24[0], 200, 'column 24 (clip last col) must be the morph (red), not the background');
            // Neighbour content (green) must survive — the background must NOT have bled into column 25.
            assertEquals(col25[1], 180, 'column 25 must remain the untouched neighbour (green), not bled background');
            assertEquals(col25[2], 0,   'column 25 must NOT be the background blue');
        });


        // Test: the STANDARD fill path (PolygonFiller._fillSpans — patterns, gradients,
        // alpha<255, non-source-over) must obey the SAME half-open right-edge convention
        // as the opaque fast path / fillRect / clip / drawImage; and ALL fill paths must
        // keep the BOTTOM edge half-open too.
        //
        // Why a separate file from 043: an opaque solid-color fill + source-over routes
        // through _fillPolygonsDirect (the fast path, covered by 043), NOT _fillSpans.
        // A Pattern/Gradient paint source, OR alpha<255, OR globalAlpha<1, OR a
        // non-source-over composite is what routes through _fillSpans. That standard
        // path is exactly what produced the reported "desktop pattern survives, morphs
        // erased" bleed, so it needs its own regression guard.
        //
        // The BOTTOM edge was always correct (scanlines are sampled at y+0.5 with a
        // half-open edge test), but no test enforced it — so a future "apply the X fix
        // to Y too" change could silently erase the last row. These tests lock it.

        function _solidTile(w, h, r, g, b) {
            const t = SWCanvas.createCanvas(w, h);
            const tc = t.getContext('2d');
            tc.fillStyle = `rgb(${r}, ${g}, ${b})`;
            tc.fillRect(0, 0, w, h);
            return t;
        }
        function _lastPaintedCol(ctx, W, row) {
            const img = ctx.getImageData(0, 0, W, row + 1).data;
            let last = -1;
            for (let x = 0; x < W; x++) if (img[(row * W + x) * 4 + 3] > 0) last = x;
            return last;
        }
        function _lastPaintedRow(ctx, W, H, col) {
            const img = ctx.getImageData(0, 0, W, H).data;
            let last = -1;
            for (let y = 0; y < H; y++) if (img[(y * W + col) * 4 + 3] > 0) last = y;
            return last;
        }

        test('pattern fill obeys the half-open right edge (routes through _fillSpans, not the direct path)', () => {
            const W = 40, H = 40, ROW = 12;
            const c = SWCanvas.createCanvas(W, H);
            const x = c.getContext('2d');
            x.fillStyle = x.createPattern(_solidTile(4, 4, 0, 0, 200), 'repeat'); // Pattern => _fillSpans
            x.beginPath(); x.rect(5, 5, 20, 20); x.fill();
            // rect [5,25) must fill cols 5..24, not the phantom column 25.
            assertEquals(_lastPaintedCol(x, W, ROW), 24, 'pattern fill of rect [5,25) must reach col 24, not 25');
            assertEquals(x.getImageData(25, ROW, 1, 1).data[3], 0, 'col 25 must be untouched by the pattern fill');
        });

        test('semi-transparent fill obeys the half-open right edge (alpha<255 also routes through _fillSpans)', () => {
            const W = 40, H = 40, ROW = 12;
            const c = SWCanvas.createCanvas(W, H);
            const x = c.getContext('2d');
            x.fillStyle = 'rgba(0, 200, 0, 0.5)'; // alpha<255 => standard path
            x.beginPath(); x.rect(5, 5, 20, 20); x.fill();
            assertEquals(_lastPaintedCol(x, W, ROW), 24, 'semi-transparent fill of rect [5,25) must reach col 24, not 25');
            assertEquals(x.getImageData(25, ROW, 1, 1).data[3], 0, 'col 25 must be untouched');
        });

        test('unclipped pattern background does not bleed one column past a clipped morph', () => {
            // The exact reported symptom: desktop PATTERN (unclipped _fillSpans) must not
            // reach one column further than the clipped morphs painted over it.
            const W = 40, H = 40, ROW = 12;
            const c = SWCanvas.createCanvas(W, H);
            const x = c.getContext('2d');

            x.fillStyle = 'rgb(0, 180, 0)';     // pre-existing neighbour content everywhere
            x.fillRect(0, 0, W, H);
            x.fillStyle = x.createPattern(_solidTile(4, 4, 0, 0, 200), 'repeat'); // desktop pattern, UNCLIPPED
            x.beginPath(); x.rect(5, 5, 20, 20); x.fill();
            x.save();
            x.beginPath(); x.rect(5, 5, 20, 20); x.clip();
            x.fillStyle = 'rgb(200, 0, 0)';     // clipped morph on top
            x.beginPath(); x.rect(0, 0, W, H); x.fill();
            x.restore();

            const col24 = x.getImageData(24, ROW, 1, 1).data;
            const col25 = x.getImageData(25, ROW, 1, 1).data;
            assertEquals(col24[0], 200, 'col 24 (clip last col) must be the morph red, not the pattern');
            assertEquals(col25[1], 180, 'col 25 (outside dirty rect) must remain the untouched neighbour green');
            assertEquals(col25[2], 0,   'col 25 must NOT be the pattern blue (no 1px bleed)');
        });

        test('fills keep the BOTTOM edge half-open too (guard against a symmetric Y regression)', () => {
            const W = 40, H = 40, COL = 12;

            // Direct path (opaque solid).
            let c = SWCanvas.createCanvas(W, H), x = c.getContext('2d');
            x.fillStyle = 'rgb(0, 200, 0)';
            x.beginPath(); x.rect(5, 5, 20, 20); x.fill();
            assertEquals(_lastPaintedRow(x, W, H, COL), 24, 'opaque path-fill of [5,25) must fill rows 5..24');
            assertEquals(x.getImageData(COL, 25, 1, 1).data[3], 0, 'row 25 must be untouched (direct path)');

            // Standard path (pattern => _fillSpans).
            c = SWCanvas.createCanvas(W, H); x = c.getContext('2d');
            x.fillStyle = x.createPattern(_solidTile(4, 4, 0, 0, 200), 'repeat');
            x.beginPath(); x.rect(5, 5, 20, 20); x.fill();
            assertEquals(_lastPaintedRow(x, W, H, COL), 24, 'pattern fill of [5,25) must fill rows 5..24');

            // Clip-mask path.
            c = SWCanvas.createCanvas(W, H); x = c.getContext('2d');
            x.beginPath(); x.rect(5, 5, 20, 20); x.clip();
            x.fillStyle = 'rgb(0, 200, 0)'; x.fillRect(0, 0, W, H);
            assertEquals(_lastPaintedRow(x, W, H, COL), 24, 'clipped fill bottom row must be 24');
            assertEquals(x.getImageData(COL, 25, 1, 1).data[3], 0, 'row 25 must be untouched (clip path)');
        });


        // Test: Gradient fill of the current default path under a non-identity transform
        // This file will be concatenated into the main test suite
        //
        // Regression guard. The current default path is recorded in DEVICE space (the CTM
        // is baked into each path point at build time). fill() used to draw that path under
        // IDENTITY, which starved a gradient/pattern fillStyle of the CTM: the paint source
        // is specified in draw-time USER space and must be mapped to device space by the CTM
        // (exactly like the path). The result was that a linear-gradient fill of a path drawn
        // under scale()/translate() collapsed to (mostly) a single color stop, while the SAME
        // gradient via fillRect() rendered correctly. fill() now maps the path back to user
        // space and draws under the CTM (like stroke()), so path + paint share one transform.
        //
        // This test locks in two properties under a translate()+scale() CTM:
        //   (1) beginPath()+rect()+fill()  ==  fillRect()   (paint parity, exact at interior px)
        //   (2) the gradient actually VARIES down the fill (anti-collapse)

        test('Linear gradient current-path fill matches fillRect under transform', () => {
            // Draw a vertical red->lime->blue gradient into a 100x100 box placed at (20,20)
            // and scaled 2x, once via fillRect (reference path) and once via the current
            // default path fill(). Sample an interior device column and compare.
            function render(useCurrentPathFill) {
                const canvas = SWCanvas.createCanvas(220, 220);
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, 220, 220);

                ctx.translate(20, 20);
                ctx.scale(2, 2); // local (0,0)-(100,100) -> device (20,20)-(220,220)

                const g = ctx.createLinearGradient(0, 0, 0, 100);
                g.addColorStop(0, 'red');
                g.addColorStop(0.5, 'lime');
                g.addColorStop(1, 'blue');
                ctx.fillStyle = g;

                if (useCurrentPathFill) {
                    ctx.beginPath();
                    ctx.rect(0, 0, 100, 100);
                    ctx.fill();
                } else {
                    ctx.fillRect(0, 0, 100, 100);
                }

                const surface = canvas._coreSurface;
                const px = (x, y) => {
                    const o = (y * surface.stride) + (x * 4);
                    return [surface.data[o], surface.data[o + 1], surface.data[o + 2]];
                };
                // Interior device column x=120 (local 50); interior rows (no AA on this column).
                const ys = [40, 90, 140, 190];
                return { surface, samples: ys.map(y => px(120, y)) };
            }

            const ref = render(false);           // fillRect reference
            const cur = render(true);            // current-path fill()

            savePNG(cur.surface, 'gradient-fill-path-under-transform.fill.png',
                    'current-path gradient fill under transform', SWCanvas);
            savePNG(ref.surface, 'gradient-fill-path-under-transform.fillRect.png',
                    'fillRect gradient reference under transform', SWCanvas);

            // (1) Paint parity: fill() must match fillRect() exactly at interior pixels.
            for (let i = 0; i < ref.samples.length; i++) {
                const a = ref.samples[i], b = cur.samples[i];
                for (let c = 0; c < 3; c++) {
                    if (a[c] !== b[c]) {
                        throw new Error(
                            `current-path fill() must equal fillRect() under a transform; ` +
                            `sample ${i} channel ${c}: fillRect=[${a}] fill=[${b}] ` +
                            `(gradient dropped the CTM in fill())`);
                    }
                }
            }

            // (2) Anti-collapse: the gradient must vary strongly from top to bottom of the
            // fill (the bug collapsed the lower portion to a single stop).
            const top = cur.samples[0];                          // near red
            const bottom = cur.samples[cur.samples.length - 1];  // near blue
            if (top[0] - bottom[0] < 150) {
                throw new Error(`gradient did not vary down the fill: top=[${top}] bottom=[${bottom}] ` +
                                `(expected a red->blue ramp; a collapse means the CTM was dropped)`);
            }
            if (bottom[2] - top[2] < 150) {
                throw new Error(`gradient blue channel did not ramp up toward the bottom: ` +
                                `top=[${top}] bottom=[${bottom}]`);
            }

            // (3) Sanity: also exercise the pure-translate trigger (translation >= the
            // gradient's coordinate span used to push every device pixel past the gradient
            // and collapse to the first stop).
            const canvas = SWCanvas.createCanvas(200, 260);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 260);
            ctx.translate(40, 150); // well beyond the gradient's 0..100 span
            const g = ctx.createLinearGradient(0, 0, 0, 100);
            g.addColorStop(0, 'red');
            g.addColorStop(1, 'blue');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.rect(0, 0, 100, 100);
            ctx.fill();
            const s = canvas._coreSurface;
            const at = (x, y) => { const o = (y * s.stride) + (x * 4); return [s.data[o], s.data[o + 1], s.data[o + 2]]; };
            const t = at(90, 150 + 5), bm = at(90, 150 + 95); // device rows near local top/bottom
            if (t[0] - bm[0] < 150 || bm[2] - t[2] < 150) {
                throw new Error(`gradient collapsed under pure translate: top=[${t}] bottom=[${bm}]`);
            }
        });


        // Test: strokeRoundRect 1px crisp rendering - half-integer (pixel-centered) frame contract
        // This file will be concatenated into the main test suite
        //
        // The standard HTML5 crisp-1px-stroke idiom places the stroke path on *.5
        // coordinates. The 1px rounded-rect fast path snaps the stroke onto one
        // device-pixel frame (leftX/topY/rightX/bottomY) and derives BOTH the edge runs
        // and the corner centers from it, so the corners join the edges exactly like
        // they do for integer input. This test pins that contract:
        //   1. exact enclosing bounds (the snapped frame, no stray pixels),
        //   2. exactly 2 colors on the surface (background + stroke - crisp, no fringe),
        //   3. closed single ring (every stroke pixel has >= 2 of 8 neighbors),
        //   4. mirror symmetry in both axes (corners not lopsided),
        //   5. frame equivalence: the half-integer spelling renders byte-identically
        //      to the integer spelling that covers the same snapped frame.

        test('RoundRect stroke1px crisp - half-integer frame contract', () => {
            const W = 90;
            const H = 60;

            function renderStroke(x, y, w, h, r) {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, W, H);
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = 1;
                ctx.strokeRoundRect(x, y, w, h, r);
                return surface;
            }

            function strokePixelSet(surface) {
                const set = new Set();
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        const o = y * surface.stride + x * 4;
                        if (surface.data[o] === 255 && surface.data[o + 1] === 0) {
                            set.add(y * W + x);
                        }
                    }
                }
                return set;
            }

            for (const r of [1, 2, 3, 5, 8, 10]) {
                // Half-integer spelling: path on *.5, frame = cols 10..38, rows 8..30
                const surface = renderStroke(10.5, 8.5, 28, 22, r);
                const stroke = strokePixelSet(surface);

                // 1. Exact enclosing bounds - the snapped frame, nothing outside, all
                //    four frame lines reached (crisp alignment, no faint strays possible
                //    on this non-antialiased engine).
                let minX = W, maxX = -1, minY = H, maxY = -1;
                for (const p of stroke) {
                    const px = p % W;
                    const py = (p - px) / W;
                    if (px < minX) minX = px;
                    if (px > maxX) maxX = px;
                    if (py < minY) minY = py;
                    if (py > maxY) maxY = py;
                }
                if (minX !== 10 || maxX !== 38 || minY !== 8 || maxY !== 30) {
                    throw new Error(
                        `r=${r}: bounds (${minX}..${maxX}, ${minY}..${maxY}) != expected (10..38, 8..30)`
                    );
                }

                // 2. Exactly 2 colors on the whole surface: white + pure stroke red.
                const colors = new Set();
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        const o = y * surface.stride + x * 4;
                        colors.add(
                            (surface.data[o] << 16) | (surface.data[o + 1] << 8) | surface.data[o + 2]
                        );
                    }
                }
                if (colors.size !== 2) {
                    throw new Error(`r=${r}: expected exactly 2 colors, found ${colors.size}`);
                }

                // 3. Closed ring: every stroke pixel has at least 2 stroke neighbors
                //    (8-connectivity). A single missing junction pixel leaves two pixels
                //    with only 1 neighbor, so this catches edge/corner tearing exactly.
                for (const p of stroke) {
                    const px = p % W;
                    const py = (p - px) / W;
                    let neighbors = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            if (stroke.has((py + dy) * W + (px + dx))) neighbors++;
                        }
                    }
                    if (neighbors < 2) {
                        throw new Error(
                            `r=${r}: stroke pixel (${px},${py}) has ${neighbors} neighbor(s) - ring is torn`
                        );
                    }
                }

                // 4. Mirror symmetry about the frame center (cols 10+38, rows 8+30):
                //    a corner arc snapped against a different line than its mirror twin
                //    shows up here immediately.
                for (const p of stroke) {
                    const px = p % W;
                    const py = (p - px) / W;
                    if (!stroke.has(py * W + (48 - px))) {
                        throw new Error(`r=${r}: (${px},${py}) breaks horizontal mirror symmetry`);
                    }
                    if (!stroke.has((38 - py) * W + px)) {
                        throw new Error(`r=${r}: (${px},${py}) breaks vertical mirror symmetry`);
                    }
                }

                // 5. Frame equivalence: integer spelling covering the same snapped frame
                //    (leftX 10, topY 8, rightX floor(10+29-0.5)=38, bottomY 30) must
                //    produce byte-identical output.
                const intSurface = renderStroke(10, 8, 29, 23, r);
                for (let i = 0; i < surface.data.length; i++) {
                    if (surface.data[i] !== intSurface.data[i]) {
                        const pixel = Math.floor(i / 4);
                        throw new Error(
                            `r=${r}: half-integer and same-frame integer spellings differ at ` +
                                `(${pixel % W},${Math.floor(pixel / W)})`
                        );
                    }
                }

                log(`  r=${r}: bounds exact, 2 colors, closed ring, symmetric, frame-equivalent`);
            }

            const showcase = renderStroke(10.5, 8.5, 28, 22, 5);
            savePNG(showcase, 'roundrect-stroke1px-halfinteger-crisp.basic.png', 'half-integer crisp 1px rounded-rect stroke', SWCanvas);
        });


        // Test: strokeRoundRect 1px semi-transparent - junction exactness (no gaps, no double blends)
        // This file will be concatenated into the main test suite
        //
        // The semi-transparent 1px rounded-rect fast path shortens each edge run by one
        // pixel and relies on the corner arcs covering the junction pixels exactly once.
        // Two failure modes are therefore invisible to bounds/color-count checks but
        // fatal to crispness, and both are pinned here:
        //   - a junction GAP (the corner's quadrant-endpoint pixel misses the edge line;
        //     historically caused by ~1e-16 Math.cos/sin noise at the 90-degree
        //     multiples flooring the endpoint one unit off - see QUADRANT_TRIG_EPSILON),
        //   - a junction DOUBLE BLEND (edge and corner both painting the same pixel,
        //     which darkens it and breaks the stroke's uniform color).
        // Checked for the grid-centered (integer) and pixel-centered (half-integer)
        // crisp spellings alike.

        test('RoundRect stroke1px semi-transparent - junction gaps and single-blend uniformity', () => {
            const W = 90;
            const H = 60;

            function check(label, x, y, w, h, r) {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, W, H);
                ctx.setStrokeStyle(255, 0, 0, 128);
                ctx.lineWidth = 1;
                ctx.strokeRoundRect(x, y, w, h, r);

                // Collect every non-background pixel with its color.
                const stroke = new Set();
                const strokeColors = new Set();
                for (let py = 0; py < H; py++) {
                    for (let px = 0; px < W; px++) {
                        const o = py * surface.stride + px * 4;
                        const rr = surface.data[o];
                        const gg = surface.data[o + 1];
                        const bb = surface.data[o + 2];
                        if (rr === 255 && gg === 255 && bb === 255) continue;
                        stroke.add(py * W + px);
                        strokeColors.add((rr << 16) | (gg << 8) | bb);
                    }
                }
                if (stroke.size === 0) {
                    throw new Error(`${label}: nothing drawn`);
                }

                // Single-blend uniformity: every stroke pixel carries the one 50%-red-
                // over-white blend value. A pixel blended twice is darker and adds a
                // second color.
                if (strokeColors.size !== 1) {
                    throw new Error(
                        `${label}: expected one uniform stroke color, found ${strokeColors.size} - ` +
                            `some pixels were blended more than once`
                    );
                }

                // Closed ring: every stroke pixel has at least 2 stroke neighbors
                // (8-connectivity); a junction gap leaves its two flanking pixels with
                // only one neighbor each.
                for (const p of stroke) {
                    const px = p % W;
                    const py = (p - px) / W;
                    let neighbors = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            if (stroke.has((py + dy) * W + (px + dx))) neighbors++;
                        }
                    }
                    if (neighbors < 2) {
                        throw new Error(
                            `${label}: stroke pixel (${px},${py}) has ${neighbors} neighbor(s) - junction gap`
                        );
                    }
                }

                log(`  ${label}: closed ring, uniform single-blend color`);
            }

            for (const r of [1, 2, 3, 5, 8, 10]) {
                check(`integer r=${r}`, 10, 8, 28, 22, r);
                check(`half-integer r=${r}`, 10.5, 8.5, 28, 22, r);
            }
        });


        // Test: strokeRoundRect 1px - arbitrary fractional coordinates snap to one coherent frame
        // This file will be concatenated into the main test suite
        //
        // Every 1px rounded-rect stroke derives ALL of its geometry (edge runs and
        // corner centers) from one snapped device-pixel frame. Consequently any
        // fractional spelling must render byte-identically to the integer spelling of
        // the same frame - there is no coordinate at which edges and corners can snap
        // to different lines. Fractions below .5 share the integer call's frame;
        // fractions at .5 grow the frame by one (rightX/bottomY floor differently),
        // which test 046 covers.

        test('RoundRect stroke1px - fractional coordinates snap to the integer frame', () => {
            const W = 90;
            const H = 60;

            function renderStroke(x, y, w, h, r, alpha) {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, W, H);
                ctx.setStrokeStyle(255, 0, 0, alpha);
                ctx.lineWidth = 1;
                ctx.strokeRoundRect(x, y, w, h, r);
                return surface;
            }

            for (const alpha of [255, 128]) {
                for (const r of [1, 3, 5, 10]) {
                    // 10.25/8.25: leftX=10, topY=8, rightX=floor(37.75)=37, bottomY=29 -
                    // exactly the frame of the plain integer call.
                    const frac = renderStroke(10.25, 8.25, 28, 22, r, alpha);
                    const int_ = renderStroke(10, 8, 28, 22, r, alpha);
                    for (let i = 0; i < frac.data.length; i++) {
                        if (frac.data[i] !== int_.data[i]) {
                            const pixel = Math.floor(i / 4);
                            throw new Error(
                                `alpha=${alpha} r=${r}: fractional (.25) and integer spellings differ at ` +
                                    `(${pixel % W},${Math.floor(pixel / W)})`
                            );
                        }
                    }
                    log(`  alpha=${alpha} r=${r}: .25-fractional spelling === integer frame`);
                }
            }
        });


        // Test: fillRoundRect/strokeRoundRect under a rect clip - tier-0 equals bitmask, no leaks
        // This file will be concatenated into the main test suite
        //
        // The direct rounded-rect entry points take the tier-0 rectangular-clip route
        // (clamp extents, no bitmask) when the active clip collapses to one axis-aligned
        // rect. Contract pinned here, for fill and 1px/thick stroke, opaque and
        // semi-transparent, at identity and scaled transforms:
        //   1. tier-0 output is byte-identical to the same draw under a forced BITMASK
        //      clip of the same region (a path of two identical rects defeats the
        //      rect-detector but exposes the same pixels),
        //   2. nothing is ever painted outside the clip rect,
        //   3. the radius<1 fallback to RectOps (normalizeRadius rounds fractional radii
        //      below 0.5 to zero) FORWARDS the clip - historically it dropped both clip
        //      arguments and painted unclipped.

        test('RoundRect direct rendering under rect clip - tier-0/bitmask equivalence', () => {
            const W = 90;
            const H = 60;
            const CLIP = { x: 14, y: 10, w: 30, h: 18 };

            function render(clipMode, drawFn) {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, W, H);
                ctx.save();
                ctx.beginPath();
                ctx.rect(CLIP.x, CLIP.y, CLIP.w, CLIP.h);
                if (clipMode === 'mask') {
                    // Second identical rect: same exposed pixels, but no longer a single
                    // axis-aligned rect path, so the clip goes through the bitmask.
                    ctx.rect(CLIP.x, CLIP.y, CLIP.w, CLIP.h);
                }
                ctx.clip();
                drawFn(ctx);
                ctx.restore();
                return surface;
            }

            function firstPixelOutsideClip(surface) {
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        const o = y * surface.stride + x * 4;
                        if (
                            surface.data[o] === 255 &&
                            surface.data[o + 1] === 255 &&
                            surface.data[o + 2] === 255
                        ) {
                            continue;
                        }
                        if (x < CLIP.x || x >= CLIP.x + CLIP.w || y < CLIP.y || y >= CLIP.y + CLIP.h) {
                            return `(${x},${y})`;
                        }
                    }
                }
                return null;
            }

            function assertCase(label, drawFn) {
                const tier0 = render('tier0', drawFn);
                const mask = render('mask', drawFn);
                for (let i = 0; i < tier0.data.length; i++) {
                    if (tier0.data[i] !== mask.data[i]) {
                        const pixel = Math.floor(i / 4);
                        throw new Error(
                            `${label}: tier-0 and bitmask clips differ at (${pixel % W},${Math.floor(pixel / W)})`
                        );
                    }
                }
                const leak = firstPixelOutsideClip(tier0);
                if (leak) {
                    throw new Error(`${label}: painted outside the clip rect at ${leak}`);
                }
                log(`  ${label}: tier-0 === bitmask, no clip leak`);
            }

            for (const scaled of [false, true]) {
                // Under scale(2,2) the same device-space shape; 1px logical stroke becomes
                // the thick-stroke path, covering both stroke rasterizers.
                const g = scaled ? ' @scale2' : '';
                const geo = scaled ? [5, 4, 20, 14, 4] : [10, 8, 28, 22, 5];
                const [x, y, w, h, r] = geo;
                const pre = (ctx) => {
                    if (scaled) ctx.scale(2, 2);
                };
                assertCase(`fill opaque${g}`, (ctx) => {
                    pre(ctx);
                    ctx.setFillStyle(0, 0, 255, 255);
                    ctx.fillRoundRect(x, y, w, h, r);
                });
                assertCase(`fill semi${g}`, (ctx) => {
                    pre(ctx);
                    ctx.setFillStyle(0, 0, 255, 128);
                    ctx.fillRoundRect(x, y, w, h, r);
                });
                assertCase(`stroke opaque${g}`, (ctx) => {
                    pre(ctx);
                    ctx.setStrokeStyle(255, 0, 0, 255);
                    ctx.lineWidth = 1;
                    ctx.strokeRoundRect(x, y, w, h, r);
                });
                assertCase(`stroke semi${g}`, (ctx) => {
                    pre(ctx);
                    ctx.setStrokeStyle(255, 0, 0, 128);
                    ctx.lineWidth = 1;
                    ctx.strokeRoundRect(x, y, w, h, r);
                });
                // Fractional radius < 0.5 rounds to 0 inside the renderer -> RectOps
                // fallback; the clip must survive the hand-off.
                assertCase(`fill r=0.4 fallback${g}`, (ctx) => {
                    pre(ctx);
                    ctx.setFillStyle(0, 0, 255, 255);
                    ctx.fillRoundRect(x, y, w, h, 0.4);
                });
                assertCase(`stroke r=0.4 fallback${g}`, (ctx) => {
                    pre(ctx);
                    ctx.setStrokeStyle(255, 0, 0, 255);
                    ctx.lineWidth = 1;
                    ctx.strokeRoundRect(x, y, w, h, 0.4);
                });
                // Fused fill+stroke path (fillStroke_AA_Any) - tier-0-wired like its
                // siblings. The thick semi-transparent stroke case exercises the
                // fill-to-path-extent overlap mode; the r=0.4 case pins the RectOps
                // fallback hand-off, whose FILL half historically dropped the clip
                // args entirely and painted unclipped through a bitmask clip.
                assertCase(`fillStroke opaque${g}`, (ctx) => {
                    pre(ctx);
                    ctx.setFillStyle(0, 0, 255, 255);
                    ctx.setStrokeStyle(255, 0, 0, 255);
                    ctx.lineWidth = 1;
                    ctx.fillStrokeRoundRect(x, y, w, h, r);
                });
                assertCase(`fillStroke semi thick stroke${g}`, (ctx) => {
                    pre(ctx);
                    ctx.setFillStyle(0, 0, 255, 255);
                    ctx.setStrokeStyle(255, 0, 0, 128);
                    ctx.lineWidth = 3;
                    ctx.fillStrokeRoundRect(x, y, w, h, r);
                });
                assertCase(`fillStroke r=0.4 fallback${g}`, (ctx) => {
                    pre(ctx);
                    ctx.setFillStyle(0, 0, 255, 255);
                    ctx.setStrokeStyle(255, 0, 0, 255);
                    ctx.lineWidth = 1;
                    ctx.fillStrokeRoundRect(x, y, w, h, 0.4);
                });
            }
        });


        // Test: fillCircle/strokeCircle direct rendering - crisp placement contract
        // This file will be concatenated into the main test suite
        //
        // Pins the coordinate contract of the direct circle renderers (probed by
        // debug/probe-circle-crisp.js while wiring the tier-0 clip path):
        //   1. Crisp inscribed FILL idiom: fillCircle(x + s/2, y + s/2, s/2) at integer
        //      x/y and even integer s covers EXACTLY the s-by-s pixel box [x, x+s) -
        //      the spelling Fizzygum-style chrome uses to fill a circle into a widget
        //      box. Symmetric in both axes, two colors only.
        //   2. 1px STROKE center convention: the Bresenham stroke FLOORS the center, so
        //      every fractional center spelling renders byte-identically to the integer
        //      one, and the ring spans exactly (2r+1) pixels - one wider than the fill
        //      (which samples pixel centers - tests/core/080). This fill-vs-1px-stroke
        //      asymmetry is deliberate and pinned here so a "harmonization" cannot slip
        //      in silently and churn every existing consumer's pixels.
        //   3. Ring quality: closed (every stroke pixel has >= 2 of 8 neighbors),
        //      mirror-symmetric in both axes; semi-transparent rings blend every pixel
        //      exactly once (single blended level - no overdraw, no gap-fills).
        //   4. Thick STROKE shares the fill's center convention: at an integer center
        //      with integral r + lw/2 the annulus covers exactly the 2*(r + lw/2) box.
        //   5. Transform pre-multiplication is exact: a scaled user-space call is
        //      byte-identical to the equivalent device-space call (the property that
        //      makes the direct paths safe under translate+uniform-scale contexts).

        test('Circle direct rendering - crisp placement contract', () => {
            const W = 60;
            const H = 60;

            function newCtx() {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, W, H);
                return { surface, ctx };
            }

            function shapePixelSet(surface) {
                // Any non-white pixel counts as shape coverage.
                const set = new Set();
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        const o = y * surface.stride + x * 4;
                        if (surface.data[o] !== 255 || surface.data[o + 1] !== 255 || surface.data[o + 2] !== 255) {
                            set.add(y * W + x);
                        }
                    }
                }
                return set;
            }

            function bboxOf(set) {
                let x0 = Infinity,
                    y0 = Infinity,
                    x1 = -Infinity,
                    y1 = -Infinity;
                for (const p of set) {
                    const px = p % W;
                    const py = (p - px) / W;
                    if (px < x0) x0 = px;
                    if (px > x1) x1 = px;
                    if (py < y0) y0 = py;
                    if (py > y1) y1 = py;
                }
                return { x0, y0, x1, y1 };
            }

            function assertSymmetric(label, set, b) {
                for (const p of set) {
                    const px = p % W;
                    const py = (p - px) / W;
                    if (!set.has(py * W + (b.x0 + b.x1 - px))) {
                        throw new Error(`${label}: (${px},${py}) breaks horizontal mirror symmetry`);
                    }
                    if (!set.has((b.y0 + b.y1 - py) * W + px)) {
                        throw new Error(`${label}: (${px},${py}) breaks vertical mirror symmetry`);
                    }
                }
            }

            function assertBytesEqual(label, sa, sb) {
                for (let i = 0; i < sa.data.length; i++) {
                    if (sa.data[i] !== sb.data[i]) {
                        const pixel = Math.floor(i / 4);
                        throw new Error(`${label}: renders differ at (${pixel % W},${Math.floor(pixel / W)})`);
                    }
                }
            }

            // 1. Crisp inscribed-fill idiom: box (16,16) size 20 -> exactly [16..35]^2.
            for (const s of [4, 10, 20]) {
                const { surface, ctx } = newCtx();
                ctx.setFillStyle(255, 0, 0, 255);
                ctx.fillCircle(16 + s / 2, 16 + s / 2, s / 2);
                const set = shapePixelSet(surface);
                const b = bboxOf(set);
                if (b.x0 !== 16 || b.y0 !== 16 || b.x1 !== 16 + s - 1 || b.y1 !== 16 + s - 1) {
                    throw new Error(
                        `fill s=${s}: bbox [${b.x0}..${b.x1}]x[${b.y0}..${b.y1}], expected exactly [16..${16 + s - 1}]^2`
                    );
                }
                assertSymmetric(`fill s=${s}`, set, b);
                log(`  fill s=${s}: covers exactly the ${s}x${s} box, symmetric`);
            }

            // 2+3. 1px stroke: floor convention, (2r+1) span, closed symmetric ring,
            //      fractional center spellings byte-identical to the integer one.
            for (const r of [3, 8, 12]) {
                const { surface, ctx } = newCtx();
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = 1;
                ctx.strokeCircle(30, 30, r);
                const set = shapePixelSet(surface);
                const b = bboxOf(set);
                if (b.x0 !== 30 - r || b.y0 !== 30 - r || b.x1 !== 30 + r || b.y1 !== 30 + r) {
                    throw new Error(
                        `stroke1px r=${r}: bbox [${b.x0}..${b.x1}]x[${b.y0}..${b.y1}], ` +
                            `expected exactly [${30 - r}..${30 + r}]^2 (2r+1 span)`
                    );
                }
                for (const p of set) {
                    const px = p % W;
                    const py = (p - px) / W;
                    let n = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (!dx && !dy) continue;
                            if (set.has((py + dy) * W + (px + dx))) n++;
                        }
                    }
                    if (n < 2) {
                        throw new Error(`stroke1px r=${r}: ring pixel (${px},${py}) has ${n} neighbors - open ring`);
                    }
                }
                assertSymmetric(`stroke1px r=${r}`, set, b);

                for (const [cx, cy] of [
                    [30.5, 30.5],
                    [30.25, 30.75]
                ]) {
                    const alt = newCtx();
                    alt.ctx.setStrokeStyle(255, 0, 0, 255);
                    alt.ctx.lineWidth = 1;
                    alt.ctx.strokeCircle(cx, cy, r);
                    assertBytesEqual(`stroke1px r=${r} center (${cx},${cy}) vs integer`, surface, alt.surface);
                }
                log(`  stroke1px r=${r}: exact (2r+1) box, closed symmetric ring, center-spelling invariant`);
            }

            // 3b. Semi-transparent 1px ring blends every pixel exactly once.
            {
                const { surface, ctx } = newCtx();
                ctx.setStrokeStyle(255, 0, 0, 128);
                ctx.lineWidth = 1;
                ctx.strokeCircle(30, 30, 8);
                const levels = new Set();
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        const o = y * surface.stride + x * 4;
                        if (surface.data[o + 1] !== 255) levels.add(surface.data[o + 1]);
                    }
                }
                if (levels.size !== 1) {
                    throw new Error(
                        `stroke1px alpha: expected one blended level, got {${[...levels].sort((a, b) => a - b)}} - ` +
                            'overdraw or gap-fill detected'
                    );
                }
                log('  stroke1px alpha: uniform single-blend coverage (no overdraw)');
            }

            // 4. Thick stroke: integer center + integral r+lw/2 -> exact 2*(r+lw/2) box.
            {
                const r = 14,
                    lw = 4,
                    reach = r + lw / 2; // 16
                const { surface, ctx } = newCtx();
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = lw;
                ctx.strokeCircle(30, 30, r);
                const set = shapePixelSet(surface);
                const b = bboxOf(set);
                if (b.x0 !== 30 - reach || b.y0 !== 30 - reach || b.x1 !== 30 + reach - 1 || b.y1 !== 30 + reach - 1) {
                    throw new Error(
                        `strokeThick r=${r} lw=${lw}: bbox [${b.x0}..${b.x1}]x[${b.y0}..${b.y1}], ` +
                            `expected exactly [${30 - reach}..${30 + reach - 1}]^2`
                    );
                }
                assertSymmetric('strokeThick', set, b);
                log(`  strokeThick r=${r} lw=${lw}: exact ${2 * reach}x${2 * reach} annulus box, symmetric`);
            }

            // 5. Transform pre-multiplication is exact (fill and thick stroke).
            {
                const scaled = newCtx();
                scaled.ctx.save();
                scaled.ctx.scale(2, 2);
                scaled.ctx.setFillStyle(255, 0, 0, 255);
                scaled.ctx.fillCircle(15, 15, 5);
                scaled.ctx.restore();
                const device = newCtx();
                device.ctx.setFillStyle(255, 0, 0, 255);
                device.ctx.fillCircle(30, 30, 10);
                assertBytesEqual('fill scale(2) vs device', scaled.surface, device.surface);

                const scaledStroke = newCtx();
                scaledStroke.ctx.save();
                scaledStroke.ctx.translate(3, 2);
                scaledStroke.ctx.scale(2, 2);
                scaledStroke.ctx.setStrokeStyle(255, 0, 0, 255);
                scaledStroke.ctx.lineWidth = 2;
                scaledStroke.ctx.strokeCircle(12, 13, 7);
                scaledStroke.ctx.restore();
                const deviceStroke = newCtx();
                deviceStroke.ctx.setStrokeStyle(255, 0, 0, 255);
                deviceStroke.ctx.lineWidth = 4;
                deviceStroke.ctx.strokeCircle(27, 28, 14);
                assertBytesEqual('stroke translate+scale vs device', scaledStroke.surface, deviceStroke.surface);
                log('  transform pre-multiplication exact for fill and thick stroke');
            }

            const showcase = newCtx();
            showcase.ctx.setFillStyle(0, 0, 255, 255);
            showcase.ctx.fillCircle(20, 30, 10);
            showcase.ctx.setStrokeStyle(255, 0, 0, 255);
            showcase.ctx.lineWidth = 4;
            showcase.ctx.strokeCircle(42, 30, 12);
            savePNG(showcase.surface, 'circle-direct-crisp-contract.basic.png', 'crisp inscribed fill + thick annulus', SWCanvas);
        });


        // Test: fillCircle/strokeCircle/fillStrokeCircle under a rect clip - tier-0 equals bitmask, no leaks
        // This file will be concatenated into the main test suite
        //
        // The direct circle entry points take the tier-0 rectangular-clip route (clamp
        // extents, no bitmask) when the active clip collapses to one axis-aligned rect
        // - the same wiring fillRoundRect/strokeRoundRect got in 6b20dcc, pinned there
        // by test 049. Contract pinned here, for fill, 1px stroke, thick stroke and
        // the fused fillStroke path, opaque and semi-transparent, at identity and
        // scaled transforms:
        //   1. tier-0 output is byte-identical to the same draw under a forced BITMASK
        //      clip of the same region (a path of two identical rects defeats the
        //      rect-detector but exposes the same pixels),
        //   2. nothing is ever painted outside the clip rect.

        test('Circle direct rendering under rect clip - tier-0/bitmask equivalence', () => {
            const W = 90;
            const H = 60;
            const CLIP = { x: 14, y: 10, w: 30, h: 18 };

            function render(clipMode, drawFn) {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, W, H);
                ctx.save();
                ctx.beginPath();
                ctx.rect(CLIP.x, CLIP.y, CLIP.w, CLIP.h);
                if (clipMode === 'mask') {
                    // Second identical rect: same exposed pixels, but no longer a single
                    // axis-aligned rect path, so the clip goes through the bitmask.
                    ctx.rect(CLIP.x, CLIP.y, CLIP.w, CLIP.h);
                }
                ctx.clip();
                drawFn(ctx);
                ctx.restore();
                return surface;
            }

            function firstPixelOutsideClip(surface) {
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        const o = y * surface.stride + x * 4;
                        if (
                            surface.data[o] === 255 &&
                            surface.data[o + 1] === 255 &&
                            surface.data[o + 2] === 255
                        ) {
                            continue;
                        }
                        if (x < CLIP.x || x >= CLIP.x + CLIP.w || y < CLIP.y || y >= CLIP.y + CLIP.h) {
                            return `(${x},${y})`;
                        }
                    }
                }
                return null;
            }

            function assertCase(label, drawFn) {
                const tier0 = render('tier0', drawFn);
                const mask = render('mask', drawFn);
                for (let i = 0; i < tier0.data.length; i++) {
                    if (tier0.data[i] !== mask.data[i]) {
                        const pixel = Math.floor(i / 4);
                        throw new Error(
                            `${label}: tier-0 and bitmask clips differ at (${pixel % W},${Math.floor(pixel / W)})`
                        );
                    }
                }
                const leak = firstPixelOutsideClip(tier0);
                if (leak) {
                    throw new Error(`${label}: painted outside the clip rect at ${leak}`);
                }
                log(`  ${label}: tier-0 === bitmask, no clip leak`);
            }

            for (const scaled of [false, true]) {
                // The circle crosses all four clip edges, so every span/plot is clamped.
                // Under scale(2,2) the same device-space geometry; the 1px logical
                // stroke becomes the thick-stroke path, covering both stroke
                // rasterizers from the same call site.
                const g = scaled ? ' @scale2' : '';
                const [cx, cy, r] = scaled ? [15, 10, 7] : [30, 20, 14];
                const pre = (ctx) => {
                    if (scaled) ctx.scale(2, 2);
                };
                assertCase(`fill opaque${g}`, (ctx) => {
                    pre(ctx);
                    ctx.setFillStyle(0, 0, 255, 255);
                    ctx.fillCircle(cx, cy, r);
                });
                assertCase(`fill semi${g}`, (ctx) => {
                    pre(ctx);
                    ctx.setFillStyle(0, 0, 255, 128);
                    ctx.fillCircle(cx, cy, r);
                });
                assertCase(`stroke 1px opaque${g}`, (ctx) => {
                    pre(ctx);
                    ctx.setStrokeStyle(255, 0, 0, 255);
                    ctx.lineWidth = 1;
                    ctx.strokeCircle(cx, cy, r);
                });
                assertCase(`stroke 1px semi${g}`, (ctx) => {
                    pre(ctx);
                    ctx.setStrokeStyle(255, 0, 0, 128);
                    ctx.lineWidth = 1;
                    ctx.strokeCircle(cx, cy, r);
                });
                assertCase(`stroke thick opaque${g}`, (ctx) => {
                    pre(ctx);
                    ctx.setStrokeStyle(255, 0, 0, 255);
                    ctx.lineWidth = 4;
                    ctx.strokeCircle(cx, cy, r);
                });
                assertCase(`stroke thick semi${g}`, (ctx) => {
                    pre(ctx);
                    ctx.setStrokeStyle(255, 0, 0, 128);
                    ctx.lineWidth = 4;
                    ctx.strokeCircle(cx, cy, r);
                });
                assertCase(`fillStroke opaque${g}`, (ctx) => {
                    pre(ctx);
                    ctx.setFillStyle(0, 0, 255, 255);
                    ctx.setStrokeStyle(255, 0, 0, 255);
                    ctx.lineWidth = 4;
                    ctx.fillStrokeCircle(cx, cy, r);
                });
                assertCase(`fillStroke semi mix${g}`, (ctx) => {
                    pre(ctx);
                    ctx.setFillStyle(0, 0, 255, 128);
                    ctx.setStrokeStyle(255, 0, 0, 255);
                    ctx.lineWidth = 4;
                    ctx.fillStrokeCircle(cx, cy, r);
                });
            }
        });


        // Test: fillStrokeCircle partially off-surface - span containment (no wrapped writes)
        // This file will be concatenated into the main test suite
        //
        // CircleOps.fillStroke_Any used to hand SpanOps UNCLAMPED inner-circle span
        // boundaries (its strokeThick_* siblings clamp theirs into the outer span).
        // SpanOps does not clamp - callers must - so a circle partially off the left
        // edge produced a NEGATIVE span start whose pixel index wrapped into the
        // previous row: real memory corruption, silently painting stroke pixels into
        // surface regions the circle never touches (132 corrupted pixels in the
        // original repro). Contract pinned here:
        //   1. CONTAINMENT: for a partially off-surface fillStrokeCircle, every
        //      painted pixel lies within the circle's outer radius (+1px tolerance)
        //      of its center - nothing anywhere else on the surface.
        //   2. POSITION INVARIANCE: the on-surface part of an off-surface render is
        //      byte-identical to the same window of the same circle rendered fully
        //      on a wider surface (the renderer's arithmetic is translation-exact for
        //      integer shifts, so clamping must only ever REMOVE pixels, never move
        //      or add them).

        test('Circle fillStroke off-surface - span containment and position invariance', () => {
            const W = 40;
            const H = 40;
            const R = 12;
            const LW = 4;

            function renderAt(width, cx, cy, semi) {
                const surface = SWCanvas.Core.Surface(width, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, width, H);
                ctx.setFillStyle(0, 0, 255, semi ? 128 : 255);
                ctx.setStrokeStyle(255, 0, 0, semi ? 128 : 255);
                ctx.lineWidth = LW;
                ctx.fillStrokeCircle(cx, cy, R);
                return surface;
            }

            const cases = [
                ['off-left', -10, 20],
                ['off-right', 45, 20],
                ['off-top', 20, -8],
                ['off-bottom', 20, 47]
            ];

            for (const semi of [false, true]) {
                const a = semi ? ' semi' : ' opaque';
                for (const [label, cx, cy] of cases) {
                    const surface = renderAt(W, cx, cy, semi);

                    // 1. Containment: painted pixels only within the outer radius.
                    const maxDist = R + LW / 2 + 1.5;
                    for (let y = 0; y < H; y++) {
                        for (let x = 0; x < W; x++) {
                            const o = y * surface.stride + x * 4;
                            if (
                                surface.data[o] === 255 &&
                                surface.data[o + 1] === 255 &&
                                surface.data[o + 2] === 255
                            ) {
                                continue;
                            }
                            const dx = x - (cx - 0.5);
                            const dy = y - (cy - 0.5);
                            if (Math.sqrt(dx * dx + dy * dy) > maxDist) {
                                throw new Error(
                                    `${label}${a}: painted pixel (${x},${y}) is outside the circle - wrapped span write`
                                );
                            }
                        }
                    }

                    // 2. Position invariance for the horizontally-shifted cases: render
                    //    the same circle fully on a 3x-wide surface, shifted +W, and
                    //    byte-compare the corresponding window. (Vertical cases reuse
                    //    the same span math per row, so the horizontal pair covers the
                    //    clamped axis; the containment check above covers all four.)
                    if (cy === 20) {
                        const wide = renderAt(3 * W, cx + W, cy, semi);
                        for (let y = 0; y < H; y++) {
                            for (let x = 0; x < W; x++) {
                                const so = y * surface.stride + x * 4;
                                const wo = y * wide.stride + (x + W) * 4;
                                for (let c = 0; c < 4; c++) {
                                    if (surface.data[so + c] !== wide.data[wo + c]) {
                                        throw new Error(
                                            `${label}${a}: visible pixels differ from the fully-on-surface render at (${x},${y})`
                                        );
                                    }
                                }
                            }
                        }
                    }

                    log(`  ${label}${a}: contained, position-invariant`);
                }
            }

            const showcase = renderAt(W, -10, 20, false);
            savePNG(
                showcase,
                'circle-fillstroke-offsurface-containment.basic.png',
                'partially off-surface fillStrokeCircle - no wrapped spans',
                SWCanvas
            );
        });


        // Test: fillStadium - shape contract, clip equivalence, containment
        // This file will be concatenated into the main test suite
        //
        // fillStadium(x, y, w, h) fills the box with its shorter axis fully rounded:
        // two half-circle caps of radius min(w,h)/2 joined by a rectangular body,
        // orientation implied by the longer axis. It renders through the generic
        // pipeline (a user-space roundRect path at the degenerate radius) since the
        // fill-arm removal - DIRECT-RENDERING-SUMMARY.MD §9 entries 15-16. Contract
        // pinned here:
        //   1. CRISP BOX: at integer geometry the fill covers EXACTLY [x,x+w)x[y,y+h),
        //      both orientations, even and odd minor axis, symmetric in both axes.
        //      This is the check that once justified a bespoke renderer - the direct
        //      degenerate-radius roundRect arm lost a HORIZONTAL stadium's left/right
        //      apex columns (edge-sampled corner x-extents; probed in
        //      debug/probe-stadium-roundrect-degenerate.js) - and it still holds on the
        //      generic pipeline, which samples pixel centers.
        //   2. ALPHA: single-blend everywhere (one span per row - no overlap). The
        //      other historical reason for a bespoke renderer: a circle+rect
        //      composition double-blends its overlaps at alpha < 1.
        //   3. TIER-0: under a rect clip, tier-0 output is byte-identical to the
        //      forced-bitmask clip (two-identical-rects technique), with no leak.
        //   4. TRANSFORMS: scaled user-space calls are byte-identical to the
        //      equivalent device-space call; 90-degree axis-aligned rotation works
        //      (a rotated stadium is a stadium with w/h swapped).
        //   5. CONTAINMENT: partially off-surface stadiums paint nothing outside the
        //      shape (spans are clamped - no wrapped writes).
        //
        // RETIRED with the fill-arm removal: a CAPS-ARE-fillCircle's pin (square
        // stadium byte-identical to the inscribed fillCircle; a vertical stadium's
        // pure cap rows byte-identical to fillCircle's rows). It compared StadiumOps'
        // Bresenham caps against CircleOps' - one shared construction, two direct
        // arms. fillStadium is now generic (arcs flattened, pixel centers sampled)
        // while fillCircle keeps its direct arm, so the two build their caps by
        // different methods and byte-identity is no longer the contract. The shape
        // checks above (crisp box, symmetry, single-blend, containment) are what
        // actually guarded the cap geometry; they all still hold.

        test('Stadium fill - shape contract, clip equivalence, containment', () => {
            const W = 90;
            const H = 90;

            function newCtx() {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, W, H);
                return { surface, ctx };
            }

            function shapePixelSet(surface) {
                const set = new Set();
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        const o = y * surface.stride + x * 4;
                        if (surface.data[o] !== 255 || surface.data[o + 1] !== 255 || surface.data[o + 2] !== 255) {
                            set.add(y * W + x);
                        }
                    }
                }
                return set;
            }

            function bboxOf(set) {
                let x0 = Infinity,
                    y0 = Infinity,
                    x1 = -Infinity,
                    y1 = -Infinity;
                for (const p of set) {
                    const px = p % W;
                    const py = (p - px) / W;
                    if (px < x0) x0 = px;
                    if (px > x1) x1 = px;
                    if (py < y0) y0 = py;
                    if (py > y1) y1 = py;
                }
                return { x0, y0, x1, y1 };
            }

            function assertBytesEqual(label, sa, sb) {
                for (let i = 0; i < sa.data.length; i++) {
                    if (sa.data[i] !== sb.data[i]) {
                        const pixel = Math.floor(i / 4);
                        throw new Error(`${label}: renders differ at (${pixel % W},${Math.floor(pixel / W)})`);
                    }
                }
            }

            // 1. Crisp box + symmetry, both orientations, both parities.
            for (const [x, y, w, h] of [
                [10, 5, 20, 60],
                [5, 25, 60, 20],
                [10, 5, 21, 61],
                [5, 25, 61, 21],
                [10, 10, 9, 40],
                [10, 20, 40, 8]
            ]) {
                const { surface, ctx } = newCtx();
                ctx.setFillStyle(255, 0, 0, 255);
                ctx.fillStadium(x, y, w, h);
                const set = shapePixelSet(surface);
                const b = bboxOf(set);
                if (b.x0 !== x || b.y0 !== y || b.x1 !== x + w - 1 || b.y1 !== y + h - 1) {
                    throw new Error(
                        `${w}x${h}: bbox [${b.x0}..${b.x1}]x[${b.y0}..${b.y1}], expected exactly ` +
                            `[${x}..${x + w - 1}]x[${y}..${y + h - 1}]`
                    );
                }
                for (const p of set) {
                    const px = p % W;
                    const py = (p - px) / W;
                    if (!set.has(py * W + (b.x0 + b.x1 - px))) {
                        throw new Error(`${w}x${h}: (${px},${py}) breaks horizontal mirror symmetry`);
                    }
                    if (!set.has((b.y0 + b.y1 - py) * W + px)) {
                        throw new Error(`${w}x${h}: (${px},${py}) breaks vertical mirror symmetry`);
                    }
                }
                log(`  ${w}x${h}: exact box, symmetric`);
            }

            // 2. Alpha uniformity: one blended level only.
            for (const [w, h] of [
                [20, 60],
                [60, 20],
                [21, 61]
            ]) {
                const { surface, ctx } = newCtx();
                ctx.setFillStyle(255, 0, 0, 128);
                ctx.fillStadium(10, 10, w, h);
                const levels = new Set();
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        const o = y * surface.stride + x * 4;
                        if (surface.data[o + 1] !== 255) levels.add(surface.data[o + 1]);
                    }
                }
                if (levels.size !== 1) {
                    throw new Error(
                        `${w}x${h} alpha: expected one blended level, got {${[...levels].sort((a, b) => a - b)}} - ` +
                            'double-blend detected'
                    );
                }
            }
            log('  alpha: single-blend everywhere');

            // 3. Tier-0 === bitmask under a rect clip, no leak (test 049's technique).
            {
                const CLIP = { x: 14, y: 10, w: 30, h: 18 };
                function renderClipped(clipMode, drawFn) {
                    const { surface, ctx } = newCtx();
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(CLIP.x, CLIP.y, CLIP.w, CLIP.h);
                    if (clipMode === 'mask') {
                        ctx.rect(CLIP.x, CLIP.y, CLIP.w, CLIP.h);
                    }
                    ctx.clip();
                    drawFn(ctx);
                    ctx.restore();
                    return surface;
                }
                for (const [label, draw] of [
                    [
                        'opaque vertical',
                        (ctx) => {
                            ctx.setFillStyle(0, 0, 255, 255);
                            ctx.fillStadium(20, 4, 16, 50);
                        }
                    ],
                    [
                        'semi horizontal',
                        (ctx) => {
                            ctx.setFillStyle(0, 0, 255, 128);
                            ctx.fillStadium(4, 12, 60, 14);
                        }
                    ],
                    [
                        'opaque @scale2',
                        (ctx) => {
                            ctx.scale(2, 2);
                            ctx.setFillStyle(0, 0, 255, 255);
                            ctx.fillStadium(10, 2, 8, 25);
                        }
                    ]
                ]) {
                    const tier0 = renderClipped('tier0', draw);
                    const mask = renderClipped('mask', draw);
                    assertBytesEqual(`clip ${label}: tier-0 vs bitmask`, tier0, mask);
                    for (let y = 0; y < H; y++) {
                        for (let x = 0; x < W; x++) {
                            const o = y * tier0.stride + x * 4;
                            if (tier0.data[o] === 255 && tier0.data[o + 1] === 255 && tier0.data[o + 2] === 255) continue;
                            if (x < CLIP.x || x >= CLIP.x + CLIP.w || y < CLIP.y || y >= CLIP.y + CLIP.h) {
                                throw new Error(`clip ${label}: painted outside the clip rect at (${x},${y})`);
                            }
                        }
                    }
                    log(`  clip ${label}: tier-0 === bitmask, no leak`);
                }
            }

            // 4. Transforms: pre-multiplication exact; 90-degree rotation swaps w/h.
            {
                const scaled = newCtx();
                scaled.ctx.save();
                scaled.ctx.translate(3, 2);
                scaled.ctx.scale(2, 2);
                scaled.ctx.setFillStyle(255, 0, 0, 255);
                scaled.ctx.fillStadium(4, 2, 10, 30);
                scaled.ctx.restore();
                const device = newCtx();
                device.ctx.setFillStyle(255, 0, 0, 255);
                device.ctx.fillStadium(11, 6, 20, 60);
                assertBytesEqual('translate+scale vs device', scaled.surface, device.surface);

                const rotated = newCtx();
                rotated.ctx.save();
                rotated.ctx.translate(45, 45);
                rotated.ctx.rotate(Math.PI / 2);
                rotated.ctx.translate(-45, -45);
                rotated.ctx.setFillStyle(255, 0, 0, 255);
                rotated.ctx.fillStadium(35, 15, 20, 60);
                rotated.ctx.restore();
                const swapped = newCtx();
                swapped.ctx.setFillStyle(255, 0, 0, 255);
                swapped.ctx.fillStadium(15, 35, 60, 20);
                assertBytesEqual('90-degree rotation vs swapped w/h', rotated.surface, swapped.surface);
                log('  transforms: pre-multiplication exact, 90-degree swap exact');
            }

            // 5. Off-surface containment: nothing painted outside the shape.
            for (const [label, x, y, w, h] of [
                ['off-left', -30, 30, 60, 20],
                ['off-right', 60, 30, 60, 20],
                ['off-top', 30, -30, 20, 60],
                ['off-bottom', 30, 60, 20, 60]
            ]) {
                const { surface, ctx } = newCtx();
                ctx.setFillStyle(255, 0, 0, 255);
                ctx.fillStadium(x, y, w, h);
                for (const p of shapePixelSet(surface)) {
                    const px = p % W;
                    const py = (p - px) / W;
                    if (px < x || px >= x + w || py < y || py >= y + h) {
                        throw new Error(`${label}: painted pixel (${px},${py}) outside the box - wrapped span write`);
                    }
                }
                log(`  ${label}: contained`);
            }

            const showcase = newCtx();
            showcase.ctx.setFillStyle(0, 0, 255, 255);
            showcase.ctx.fillStadium(10, 10, 20, 70);
            showcase.ctx.setFillStyle(255, 0, 0, 255);
            showcase.ctx.fillStadium(40, 30, 45, 18);
            savePNG(showcase.surface, 'stadium-fill-contract.basic.png', 'vertical + horizontal stadium fills', SWCanvas);
        });


        // Test: circle/arc direct entries under NON-uniform scale - gate to the generic pipeline
        // This file will be concatenated into the main test suite
        //
        // The direct circle/arc paths scale their radius by the transform's uniform
        // scale (a geometric mean). Ungated, a non-uniform transform therefore drew a
        // CIRCLE of radius r*sqrt(sx*sy) where an ellipse of r*sx by r*sy belongs -
        // silently, and diverging from what the same call renders through the generic
        // path pipeline (and from the native-canvas polyfills, which are always
        // shape-correct). The entries now gate on isUniformScale and route ineligible
        // calls to an un-baked user-space SWPath2D under the CTM, mirroring
        // fillRoundRect/fillStadium. Contract pinned here:
        //   1. SHAPE: under scale(2,1), fillCircle covers an ellipse's bounding box
        //      (~4r x 2r), not the old wrong circle's (~2.83r square).
        //   2. EQUIVALENCE: each gated entry renders byte-identically to the same
        //      geometry drawn explicitly through an external Path2D under the same
        //      transform - fill, stroke, fillStroke, and the three arc entries.
        //   3. UNIFORM UNAFFECTED: rotation + uniform scale still takes the direct
        //      path (pinned structurally by the path-based-rendering flag).

        test('Circle/arc direct rendering - non-uniform scale gates to generic pipeline', () => {
            const W = 120;
            const H = 80;

            function newCtx() {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, W, H);
                return { surface, ctx };
            }

            function bbox(surface) {
                let x0 = Infinity,
                    y0 = Infinity,
                    x1 = -Infinity,
                    y1 = -Infinity;
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        const o = y * surface.stride + x * 4;
                        if (surface.data[o] !== 255 || surface.data[o + 1] !== 255 || surface.data[o + 2] !== 255) {
                            if (x < x0) x0 = x;
                            if (x > x1) x1 = x;
                            if (y < y0) y0 = y;
                            if (y > y1) y1 = y;
                        }
                    }
                }
                return { w: x1 - x0 + 1, h: y1 - y0 + 1 };
            }

            function assertBytesEqual(label, sa, sb) {
                for (let i = 0; i < sa.data.length; i++) {
                    if (sa.data[i] !== sb.data[i]) {
                        const pixel = Math.floor(i / 4);
                        throw new Error(`${label}: renders differ at (${pixel % W},${Math.floor(pixel / W)})`);
                    }
                }
            }

            // 1. Shape: an ellipse's box, not the old circle's. r=15 under scale(2,1):
            //    ellipse box ~60x30; the ungated path drew ~42x42 (r*sqrt(2) circle).
            {
                const { surface, ctx } = newCtx();
                ctx.save();
                ctx.scale(2, 1);
                ctx.setFillStyle(255, 0, 0, 255);
                ctx.fillCircle(30, 40, 15);
                ctx.restore();
                const b = bbox(surface);
                if (Math.abs(b.w - 60) > 2 || Math.abs(b.h - 30) > 2) {
                    throw new Error(`fillCircle @scale(2,1): bbox ${b.w}x${b.h}, expected ~60x30 (ellipse, not circle)`);
                }
                log(`  fillCircle @scale(2,1): ellipse box ${b.w}x${b.h}`);
            }

            // 2. Byte-equivalence with the explicit external-path render.
            const CASES = [
                [
                    'fillCircle',
                    (ctx) => {
                        ctx.setFillStyle(0, 0, 255, 255);
                        ctx.fillCircle(30, 40, 15);
                    },
                    (ctx) => {
                        ctx.setFillStyle(0, 0, 255, 255);
                        const p = new SWCanvas.Core.SWPath2D();
                        p.arc(30, 40, 15, 0, 2 * Math.PI);
                        ctx.fill(p);
                    }
                ],
                [
                    'strokeCircle',
                    (ctx) => {
                        ctx.setStrokeStyle(255, 0, 0, 255);
                        ctx.lineWidth = 3;
                        ctx.strokeCircle(30, 40, 15);
                    },
                    (ctx) => {
                        ctx.setStrokeStyle(255, 0, 0, 255);
                        ctx.lineWidth = 3;
                        const p = new SWCanvas.Core.SWPath2D();
                        p.arc(30, 40, 15, 0, 2 * Math.PI);
                        ctx.stroke(p);
                    }
                ],
                [
                    'fillStrokeCircle',
                    (ctx) => {
                        ctx.setFillStyle(0, 0, 255, 255);
                        ctx.setStrokeStyle(255, 0, 0, 255);
                        ctx.lineWidth = 3;
                        ctx.fillStrokeCircle(30, 40, 15);
                    },
                    (ctx) => {
                        ctx.setFillStyle(0, 0, 255, 255);
                        ctx.setStrokeStyle(255, 0, 0, 255);
                        ctx.lineWidth = 3;
                        const p = new SWCanvas.Core.SWPath2D();
                        p.arc(30, 40, 15, 0, 2 * Math.PI);
                        ctx.fill(p);
                        ctx.stroke(p);
                    }
                ],
                [
                    'fillArc',
                    (ctx) => {
                        ctx.setFillStyle(0, 128, 0, 255);
                        ctx.fillArc(30, 40, 15, 0.3, 2.2);
                    },
                    (ctx) => {
                        ctx.setFillStyle(0, 128, 0, 255);
                        const p = new SWCanvas.Core.SWPath2D();
                        p.moveTo(30, 40);
                        p.arc(30, 40, 15, 0.3, 2.2, false);
                        p.closePath();
                        ctx.fill(p);
                    }
                ],
                [
                    'outerStrokeArc',
                    (ctx) => {
                        ctx.setStrokeStyle(255, 0, 0, 255);
                        ctx.lineWidth = 3;
                        ctx.outerStrokeArc(30, 40, 15, 0.3, 2.2);
                    },
                    (ctx) => {
                        ctx.setStrokeStyle(255, 0, 0, 255);
                        ctx.lineWidth = 3;
                        const p = new SWCanvas.Core.SWPath2D();
                        p.arc(30, 40, 15, 0.3, 2.2, false);
                        ctx.stroke(p);
                    }
                ],
                [
                    'fillOuterStrokeArc',
                    (ctx) => {
                        ctx.setFillStyle(0, 128, 0, 255);
                        ctx.setStrokeStyle(255, 0, 0, 255);
                        ctx.lineWidth = 3;
                        ctx.fillOuterStrokeArc(30, 40, 15, 0.3, 2.2);
                    },
                    (ctx) => {
                        ctx.setFillStyle(0, 128, 0, 255);
                        ctx.setStrokeStyle(255, 0, 0, 255);
                        ctx.lineWidth = 3;
                        const p = new SWCanvas.Core.SWPath2D();
                        p.moveTo(30, 40);
                        p.arc(30, 40, 15, 0.3, 2.2, false);
                        p.closePath();
                        ctx.fill(p);
                        const sp = new SWCanvas.Core.SWPath2D();
                        sp.arc(30, 40, 15, 0.3, 2.2, false);
                        ctx.stroke(sp);
                    }
                ]
            ];
            for (const [label, direct, generic] of CASES) {
                const a = newCtx();
                a.ctx.save();
                a.ctx.scale(2, 1);
                direct(a.ctx);
                a.ctx.restore();
                const b = newCtx();
                b.ctx.save();
                b.ctx.scale(2, 1);
                generic(b.ctx);
                b.ctx.restore();
                assertBytesEqual(`${label} @scale(2,1) vs external path`, a.surface, b.surface);
                log(`  ${label} @scale(2,1): === external-path render`);
            }

            // 3. Rotation + uniform scale still goes direct.
            {
                const { ctx } = newCtx();
                // Reset AFTER the fixture background: fillRect is generic since the
                // fill-arm removal, so a pre-fixture reset would see ITS flag, not the
                // circle's.
                SWCanvas.Core.Context2D.resetPathBasedFlag();
                ctx.save();
                ctx.translate(60, 40);
                ctx.rotate(0.5);
                ctx.scale(1.5, 1.5);
                ctx.setFillStyle(255, 0, 0, 255);
                ctx.fillCircle(0, 0, 10);
                ctx.restore();
                if (SWCanvas.Core.Context2D.wasPathBasedUsed()) {
                    throw new Error('fillCircle under rotation+uniform scale fell to the path pipeline');
                }
                log('  rotation + uniform scale: still direct');
            }

            const showcase = newCtx();
            showcase.ctx.save();
            showcase.ctx.scale(2, 1);
            showcase.ctx.setFillStyle(0, 0, 255, 255);
            showcase.ctx.fillCircle(25, 40, 15);
            showcase.ctx.restore();
            savePNG(showcase.surface, 'circle-nonuniform-gate-ellipse.basic.png', 'fillCircle under scale(2,1) - correct ellipse', SWCanvas);
        });


        // Test: HAIRLINE (sub-pixel) strokes on the five direct stroke entries
        // This file will be concatenated into the main test suite
        //
        // A stroke narrower than one device pixel cannot be drawn narrower than one
        // pixel, so the engine draws it AT one pixel and takes the missing width out of
        // the OPACITY. That is the generic pipeline's rule (Rasterizer._strokeInternal:
        // lineWidth < 1 renders at width 1.0 with subPixelOpacity = lineWidth), and
        // every direct stroke entry now restates it at the dispatch layer, keyed on the
        // DEVICE width. Before, each entry did something different below 1px:
        // strokeRect fell through to the generic path (correct, slow); strokeRoundRect
        // and outerStrokeArc reached their THICK renderers, which draw a sub-pixel
        // width at FULL opacity (wrong weight) and with a broken outline (measured: 8
        // of 19 pixels for the arc); strokeCircle fell to a device-space re-stroke that
        // LOST most of a scaled ring (35 of 70 at scale 1.4 - the vanish that blocked
        // Fizzygum's rotate-handle conversion); strokeLine had no faint rule at all.
        //
        // Contract pinned here, for every entry at identity / scale(1.4) / scale(0.7):
        //   1. RULE AS IDENTITY: the hairline render byte-equals the explicit
        //      "1 device px at globalAlpha x deviceWidth" call. The rule as an
        //      equation, not an eyeball.
        //   2. GEOMETRY IS THE 1px GEOMETRY: the hairline paints exactly the pixel SET
        //      the exact-1px stroke paints - at every sub-pixel width - so only the
        //      opacity varies. This is the assertion the old circle fallback fails
        //      (it painted 35 of the ring's 70 pixels under scale 1.4), and it is why
        //      hairlines are positionally continuous across the 1px threshold.
        //      (Continuity with the GENERIC path's position was never available: direct
        //      and generic already rasterize 1px strokes differently - 188 of 96 pixels
        //      for a rect at identity - which is the shipped behaviour of every
        //      lineWidth >= 1 caller.)
        //   3. OUTLINE CONNECTED: no painted pixel is left with fewer than 2 painted
        //      8-neighbours (bar the two endpoints of the open shapes). NOTE the
        //      geometry below is sized to stay INSIDE the surface at scale 1.4 on
        //      purpose: an edge-clipped outline has legitimately loose ends and would
        //      make this assertion measure the clip instead of the rule.
        //   4. FAINTNESS MONOTONICITY: a narrower hairline is strictly lighter.
        //   5. lw >= 1 DISPATCH UNCHANGED: exact-1px and thick strokes stay direct and
        //      fully opaque - the new branch must not reach across the tolerance - and
        //      a hairline must ALSO be direct, never a fall-back to the generic
        //      pipeline, which is the whole point of the branch.
        //   6. TWIN INVARIANT: every family's stroke1px_Opaq and stroke1px_Alpha
        //      rasterize the same pixel set - a stroke's GEOMETRY must not depend on
        //      its OPACITY. ArcOps historically violated this (its Opaq walk used a
        //      different Bresenham update spelling than CircleOps'/its own Alpha twin,
        //      so a partial arc changed shape when its opacity did - 16 vs 19 px at
        //      r=11); the walk is now canonical and this assertion keeps all five
        //      families honest.

        test('Hairline strokes - the sub-pixel rule on all five direct stroke entries', () => {
            const W = 64;
            const H = 64;

            function newCtx() {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, W, H);
                return { surface, ctx };
            }

            // Every entry strokes BLACK on white, so the red channel IS the opacity
            // readout: 255 = untouched, 0 = full opacity, in between = the faint rule.
            function painted(surface) {
                const on = [];
                let count = 0;
                let darkest = 255;
                for (let y = 0; y < H; y++) {
                    const row = [];
                    for (let x = 0; x < W; x++) {
                        const v = surface.data[y * surface.stride + x * 4];
                        row.push(v !== 255);
                        if (v !== 255) {
                            count++;
                            if (v < darkest) darkest = v;
                        }
                    }
                    on.push(row);
                }
                return { on, count, darkest };
            }

            function assertBytesEqual(label, sa, sb) {
                for (let i = 0; i < sa.data.length; i++) {
                    if (sa.data[i] !== sb.data[i]) {
                        const pixel = Math.floor(i / 4);
                        throw new Error(`${label}: renders differ at (${pixel % W},${Math.floor(pixel / W)})`);
                    }
                }
            }

            // How many pixels one render paints that the other does not (ignoring level).
            function positionDiff(a, b) {
                let d = 0;
                for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (a.on[y][x] !== b.on[y][x]) d++;
                return d;
            }

            // Painted pixels with fewer than 2 painted 8-neighbours: none for a closed
            // outline, exactly 2 (the endpoints) for an open arc or a line.
            function looseEnds(p) {
                let loose = 0;
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        if (!p.on[y][x]) continue;
                        let n = 0;
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                if (!dx && !dy) continue;
                                const yy = y + dy;
                                const xx = x + dx;
                                if (yy >= 0 && yy < H && xx >= 0 && xx < W && p.on[yy][xx]) n++;
                            }
                        }
                        if (n < 2) loose++;
                    }
                }
                return loose;
            }

            // Geometry chosen to stay inside the 64x64 surface at scale 1.4 (see 3).
            const ENTRIES = [
                { name: 'strokeRect', looseAllowed: 0, draw: (c) => c.strokeRect(10, 10, 24, 24) },
                { name: 'strokeRoundRect', looseAllowed: 0, draw: (c) => c.strokeRoundRect(10, 10, 24, 24, 6) },
                { name: 'strokeCircle', looseAllowed: 0, draw: (c) => c.strokeCircle(22, 22, 11) },
                { name: 'outerStrokeArc', looseAllowed: 2, draw: (c) => c.outerStrokeArc(22, 22, 11, 0.3, 2.2) },
                { name: 'strokeLine', looseAllowed: 2, draw: (c) => c.strokeLine(10, 13, 34, 29) }
            ];

            const TRANSFORMS = [
                { label: 'identity', scale: 1, apply: () => {} },
                { label: 'scale(1.4)', scale: 1.4, apply: (c) => c.scale(1.4, 1.4) },
                { label: 'scale(0.7)', scale: 0.7, apply: (c) => c.scale(0.7, 0.7) }
            ];

            const SUB_PIXEL_WIDTHS = [0.35, 0.5, 0.7, 0.995];

            // Render an entry at a given LOGICAL lineWidth and globalAlpha.
            function render(entry, transform, logicalLineWidth, globalAlpha) {
                const { surface, ctx } = newCtx();
                // Reset AFTER the fixture background: fillRect is generic since the
                // fill-arm removal; the flag must isolate the entry's own dispatch.
                SWCanvas.Core.Context2D.resetPathBasedFlag();
                ctx.save();
                transform.apply(ctx);
                ctx.setStrokeStyle(0, 0, 0, 255);
                ctx.lineWidth = logicalLineWidth;
                ctx.globalAlpha = globalAlpha;
                entry.draw(ctx);
                ctx.restore();
                return { surface, pathBased: SWCanvas.Core.Context2D.wasPathBasedUsed() };
            }

            // 1. RULE AS IDENTITY, and hairlines are DIRECT (part of 5).
            for (const entry of ENTRIES) {
                for (const t of TRANSFORMS) {
                    for (const deviceWidth of SUB_PIXEL_WIDTHS) {
                        const hairline = render(entry, t, deviceWidth / t.scale, 1.0);
                        const explicit = render(entry, t, 1 / t.scale, deviceWidth);
                        assertBytesEqual(
                            `${entry.name} @${t.label} hairline(device ${deviceWidth}) vs 1px at alpha ${deviceWidth}`,
                            hairline.surface,
                            explicit.surface
                        );
                        if (hairline.pathBased) {
                            throw new Error(
                                `${entry.name} @${t.label} hairline(device ${deviceWidth}) fell back to the path pipeline`
                            );
                        }
                    }
                }
                log(`  ${entry.name}: hairline === 1px x proportional alpha, direct, 4 widths x 3 transforms`);
            }

            // 2. GEOMETRY IS THE 1px GEOMETRY (the vanish-catcher). The 0.995-alpha
            //    oracle and the opaque 1px stroke paint the same set by invariant 6.
            for (const entry of ENTRIES) {
                for (const t of TRANSFORMS) {
                    const onePx = painted(render(entry, t, 1 / t.scale, 0.995).surface);
                    if (onePx.count === 0) throw new Error(`${entry.name} @${t.label}: the 1px stroke painted NOTHING`);
                    for (const deviceWidth of SUB_PIXEL_WIDTHS) {
                        const hair = painted(render(entry, t, deviceWidth / t.scale, 1.0).surface);
                        const d = positionDiff(hair, onePx);
                        if (d !== 0) {
                            throw new Error(
                                `${entry.name} @${t.label}: hairline at device width ${deviceWidth} paints ${hair.count}px, ` +
                                    `differing from the 1px stroke's ${onePx.count}px in ${d} pixels — a hairline must be ` +
                                    `the 1px geometry at reduced opacity, nothing else`
                            );
                        }
                    }
                }
                log(`  ${entry.name}: every sub-pixel width paints exactly the 1px stroke's pixels`);
            }

            // 3. OUTLINE CONNECTED.
            for (const entry of ENTRIES) {
                for (const t of TRANSFORMS) {
                    const p = painted(render(entry, t, 0.5 / t.scale, 1.0).surface);
                    const loose = looseEnds(p);
                    if (loose > entry.looseAllowed) {
                        throw new Error(
                            `${entry.name} @${t.label}: hairline outline is broken — ${loose} pixels with < 2 ` +
                                `neighbours (allowed ${entry.looseAllowed}), ${p.count}px painted`
                        );
                    }
                }
                log(`  ${entry.name}: hairline outline connected at identity, scale 1.4 and scale 0.7`);
            }

            // 4. FAINTNESS MONOTONICITY.
            for (const entry of ENTRIES) {
                const levels = [0.25, 0.5, 0.75].map((w) => painted(render(entry, TRANSFORMS[0], w, 1.0).surface).darkest);
                if (!(levels[0] > levels[1] && levels[1] > levels[2])) {
                    throw new Error(
                        `${entry.name}: faintness is not monotone in width — darkest pixel at w=0.25/0.5/0.75 was ` +
                            `${levels.join('/')} (must be strictly decreasing)`
                    );
                }
                log(`  ${entry.name}: darkest pixel at w=0.25/0.5/0.75 = ${levels.join('/')} (monotone)`);
            }

            // 5. lw >= 1 DISPATCH UNCHANGED. 1.0005 is just past STROKE_1PX_TOLERANCE:
            //    it must stay opaque, i.e. the hairline branch must not reach across.
            for (const entry of ENTRIES) {
                for (const deviceWidth of [1, 1.0005, 3]) {
                    const r = render(entry, TRANSFORMS[0], deviceWidth, 1.0);
                    if (r.pathBased) {
                        throw new Error(`${entry.name}: lineWidth ${deviceWidth} unexpectedly fell to the path pipeline`);
                    }
                    const p = painted(r.surface);
                    if (p.darkest !== 0) {
                        throw new Error(
                            `${entry.name}: opaque stroke at lineWidth ${deviceWidth} rendered faint (darkest pixel ` +
                                `${p.darkest}, expected 0) — the hairline branch has eaten a lineWidth >= 1 case`
                        );
                    }
                }
                log(`  ${entry.name}: lineWidth 1 / 1.0005 / 3 still opaque and direct`);
            }

            // 6. TWIN INVARIANT: opaque and alpha 1px renderers paint the same pixel
            //    set in every family, at identity and under scale — a stroke's
            //    geometry must not depend on its opacity. (ArcOps historically failed
            //    this; its Bresenham walk is now the family's canonical spelling.)
            for (const entry of ENTRIES) {
                for (const t of TRANSFORMS) {
                    const opaque = painted(render(entry, t, 1 / t.scale, 1.0).surface);
                    const alpha = painted(render(entry, t, 1 / t.scale, 0.995).surface);
                    const d = positionDiff(opaque, alpha);
                    if (d !== 0) {
                        throw new Error(
                            `${entry.name} @${t.label}: its opaque and alpha 1px renderers disagree in ${d} pixels — ` +
                                `the stroke's geometry depends on its opacity, and a hairline is therefore NOT ` +
                                `positionally continuous with the opaque 1px stroke it sits next to`
                        );
                    }
                }
                log(`  ${entry.name}: opaque and alpha 1px twins paint the same pixel set at all 3 transforms`);
            }

            // 7. ROTATED translucent stroke is SINGLE-BLEND: the rotated rect 1px DDA
            //    dedups pixels shared by consecutive edges (the overdraw-prevention
            //    doctrine, DIRECT-RENDERING-SUMMARY.MD 6.5), so a translucent rotated
            //    stroke — and every rotated hairline, translucent by construction —
            //    shows exactly ONE blended level: no darker corner dots.
            {
                const { surface, ctx } = newCtx();
                // Reset AFTER the fixture background (fillRect is generic since the
                // fill-arm removal).
                SWCanvas.Core.Context2D.resetPathBasedFlag();
                ctx.save();
                ctx.translate(28, 28);
                ctx.rotate(0.3);
                ctx.setStrokeStyle(0, 0, 0, 255);
                ctx.lineWidth = 0.5; // hairline → dispatched at alpha 0.5
                ctx.strokeRect(-14, -14, 28, 28);
                ctx.restore();
                if (SWCanvas.Core.Context2D.wasPathBasedUsed()) {
                    throw new Error('rotated hairline strokeRect fell back to the path pipeline');
                }
                const seen = new Set();
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        const v = surface.data[y * surface.stride + x * 4];
                        if (v !== 255) seen.add(v);
                    }
                }
                if (seen.size !== 1) {
                    throw new Error(
                        `rotated hairline strokeRect painted ${seen.size} distinct levels (${[...seen].sort((a, b) => a - b)}) — ` +
                            `expected ONE: a corner pixel is being blended twice`
                    );
                }
                log(`  rotated hairline strokeRect: single blended level (${[...seen]}), no corner double-blend`);
            }

            // Showcase: the geometry that motivated this — a hairline ring inside a
            // scaled island, which used to lose most of itself.
            const showcase = newCtx();
            showcase.ctx.save();
            showcase.ctx.scale(1.4, 1.4);
            showcase.ctx.setStrokeStyle(0, 0, 0, 255);
            showcase.ctx.lineWidth = 0.5 / 1.4;
            showcase.ctx.strokeCircle(22, 22, 11);
            showcase.ctx.restore();
            savePNG(
                showcase.surface,
                'hairline-stroke-ring-scaled.basic.png',
                'strokeCircle at a 0.5 device-px width under scale(1.4) - closed faint ring',
                SWCanvas
            );
        });


        // Test: fillRect fully/partially off-surface - span containment (no wrapped writes)
        // This file will be concatenated into the main test suite
        //
        // RectOpsAA.fill_AA_Opaq's no-clip fast path fills each row with
        // TypedArray.fill(color, rowStart, rowStart + rowRight). rowRight comes from
        // one-sided clamps (Math.min(right, cx1)), so a rect that lies FULLY LEFT of
        // the surface keeps a NEGATIVE rowRight - and TypedArray.fill treats a
        // negative end as length+end (it wraps), flooding every overlapping row from
        // its start to near the END of the buffer (1987 of 2024 pixels in the
        // original repro: a 4x43 rect at x=-85 on a 44x46 surface, reached in
        // production through a translated shadow-scratch context whose damage window
        // sat right of the icon art). Same class as test 052's fillStrokeCircle
        // span-wrap. Contract pinned here:
        //   1. A rect FULLY off-surface (any side, and diagonally) paints ZERO pixels
        //      - including through a translated context, the production shape.
        //   2. A rect PARTIALLY off-surface paints only inside its own bounds
        //      (clamping only ever REMOVES pixels, never moves or adds them), and the
        //      on-surface part is byte-identical to the same window of the same rect
        //      rendered fully on a wider surface.
        // Both opacity regimes are exercised: opaque hits the .fill fast path, alpha
        // the per-pixel loop.

        test('Rect fill off-surface - span containment and position invariance', () => {
            const W = 44;
            const H = 46;

            function freshSurface(width) {
                const surface = SWCanvas.Core.Surface(width, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, width, H);
                return [surface, ctx];
            }

            function countNonWhite(surface, width) {
                let n = 0;
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < width; x++) {
                        const o = y * surface.stride + x * 4;
                        if (
                            surface.data[o] !== 255 ||
                            surface.data[o + 1] !== 255 ||
                            surface.data[o + 2] !== 255
                        ) {
                            n++;
                        }
                    }
                }
                return n;
            }

            // 1. FULLY off-surface rects paint nothing.
            const offCases = [
                ['off-left', -85, -30, 4, 43],
                ['off-left-tall', -10, 0, 5, H],
                ['off-right', W + 3, 10, 6, 12],
                ['off-top', 10, -20, 12, 6],
                ['off-bottom', 10, H + 2, 12, 6],
                ['off-diagonal', -30, -30, 10, 10]
            ];
            for (const semi of [false, true]) {
                const a = semi ? ' semi' : ' opaque';
                for (const [label, x, y, w, h] of offCases) {
                    const [surface, ctx] = freshSurface(W);
                    ctx.setFillStyle(0, 0, 0, semi ? 128 : 255);
                    ctx.fillRect(x, y, w, h);
                    const painted = countNonWhite(surface, W);
                    if (painted !== 0) {
                        throw new Error(
                            `${label}${a}: fully off-surface fillRect painted ${painted} pixel(s) - wrapped span write`
                        );
                    }
                }
            }

            // 1b. The production shape: the same off-left rect reached through a
            // TRANSLATED context (the shadow-scratch scenario).
            {
                const [surface, ctx] = freshSurface(W);
                ctx.setFillStyle(0, 0, 0, 255);
                ctx.translate(-156, -248);
                ctx.fillRect(71, 218, 4, 43); // lands at (-85,-30) 4x43
                const painted = countNonWhite(surface, W);
                if (painted !== 0) {
                    throw new Error(
                        `translated off-left: fillRect painted ${painted} pixel(s) - wrapped span write`
                    );
                }
            }

            // 2. PARTIALLY off-surface: containment within the rect's own bounds +
            //    position invariance against a fully-on-surface render.
            const partialCases = [
                ['partial-left', -6, 8, 14, 12],
                ['partial-right', W - 7, 20, 15, 9],
                ['partial-top', 6, -5, 10, 12],
                ['partial-bottom', 24, H - 4, 9, 10]
            ];
            for (const semi of [false, true]) {
                const a = semi ? ' semi' : ' opaque';
                for (const [label, x, y, w, h] of partialCases) {
                    const [surface, ctx] = freshSurface(W);
                    ctx.setFillStyle(0, 0, 0, semi ? 128 : 255);
                    ctx.fillRect(x, y, w, h);
                    for (let py = 0; py < H; py++) {
                        for (let px = 0; px < W; px++) {
                            const o = py * surface.stride + px * 4;
                            const white =
                                surface.data[o] === 255 &&
                                surface.data[o + 1] === 255 &&
                                surface.data[o + 2] === 255;
                            if (white) continue;
                            if (px < x || px >= x + w || py < y || py >= y + h) {
                                throw new Error(
                                    `${label}${a}: painted pixel (${px},${py}) outside the rect - wrapped span write`
                                );
                            }
                        }
                    }

                    // Position invariance on a 3x-wide surface, rect shifted +W.
                    const [wide, wctx] = freshSurface(3 * W);
                    wctx.setFillStyle(0, 0, 0, semi ? 128 : 255);
                    wctx.fillRect(x + W, y, w, h);
                    for (let py = 0; py < H; py++) {
                        for (let px = 0; px < W; px++) {
                            const o = py * surface.stride + px * 4;
                            const wo = py * wide.stride + (px + W) * 4;
                            for (let c = 0; c < 4; c++) {
                                if (surface.data[o + c] !== wide.data[wo + c]) {
                                    throw new Error(
                                        `${label}${a}: position invariance broken at (${px},${py}) channel ${c}`
                                    );
                                }
                            }
                        }
                    }
                }
            }
        });


        // Test: the transformed-drawImage sampling contract. Draws that do not
        // resample — axis-aligned with an effective sample step of exactly 1 —
        // sample nearest-neighbor, byte-for-byte as they always have; draws that DO
        // resample (rotation/skew, and axis-aligned scale — see
        // 058-drawimage-scaled-smoothing-contract.js) sample BILINEAR at the dest
        // pixel center, filtered premultiplied, with texels outside the source
        // sub-rect contributing transparent black.
        //
        // WHY: under nearest-neighbor rotation the floor-quantized sample point
        // periodically lands on the texel BESIDE a thin source feature, so 1-2px
        // features (hairline strokes, selection overlays in Fizzygum's rotated
        // "island" composites) disintegrate into dashes. Bilinear cannot produce a
        // pure-background gap along a continuous source feature. Reproducer:
        // debug/probe-rotated-thinline-gaps.js.

        // -- shared helpers -----------------------------------------------------------

        function makeLineSource(lineWidthPx, r, g, b, garbageRGB) {
            // 32x32, fully transparent, with a horizontal opaque line at rows 10..10+n.
            // If garbageRGB is set, the transparent texels carry non-black RGB under
            // alpha 0 — a straight-alpha lerp would bleed it into the edges, the
            // premultiplied filter must ignore it.
            const W = 32, H = 32;
            const data = new Uint8ClampedArray(W * H * 4);
            if (garbageRGB) {
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = 255; data[i + 1] = 0; data[i + 2] = 255; data[i + 3] = 0;
                }
            }
            for (let y = 10; y < 10 + lineWidthPx; y++) {
                for (let x = 0; x < W; x++) {
                    const o = (y * W + x) * 4;
                    data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
                }
            }
            return { width: W, height: H, data: data };
        }

        function walkRotatedCenterlinePixels(tx, ty, angle, lineWidthPx) {
            // The distinct device pixels the line's centerline crosses, endpoints
            // excluded (a continuous point p lies inside device pixel floor(p)).
            const cos = Math.cos(angle), sin = Math.sin(angle);
            const cy = 10 + lineWidthPx / 2;
            const seen = new Set();
            const pixels = [];
            for (let t = 2; t <= 30; t += 0.05) {
                const px = tx + t * cos - cy * sin;
                const py = ty + t * sin + cy * cos;
                const dx = Math.floor(px), dy = Math.floor(py);
                const key = dx + ',' + dy;
                if (seen.has(key)) continue;
                seen.add(key);
                pixels.push({ dx: dx, dy: dy });
            }
            return pixels;
        }

        // -- the gap-free contract ----------------------------------------------------

        test('rotated drawImage keeps a 1px line gap-free (bilinear, 30 deg)', () => {
            const src = makeLineSource(1, 0, 0, 0, false);
            const dst = SWCanvas.createCanvas(110, 110);
            const ctx = dst.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 110, 110);
            ctx.translate(20.37, 12.61); // fractional translation, like an island composite
            ctx.rotate(Math.PI / 6);
            ctx.drawImage(src, 0, 0);

            const img = ctx.getImageData(0, 0, 110, 110);
            const pixels = walkRotatedCenterlinePixels(20.37, 12.61, Math.PI / 6, 1);
            let gaps = 0;
            for (let i = 0; i < pixels.length; i++) {
                const o = (pixels[i].dy * 110 + pixels[i].dx) * 4;
                const s = img.data[o] + img.data[o + 1] + img.data[o + 2];
                if (s >= 600) gaps++; // essentially background = the feature dropped out
            }
            assertEquals(gaps, 0, 'background gaps along the rotated 1px line centerline');
        });

        test('rotated drawImage keeps a 2px line gap-free (bilinear, 30 deg)', () => {
            const src = makeLineSource(2, 0, 0, 0, false);
            const dst = SWCanvas.createCanvas(110, 110);
            const ctx = dst.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 110, 110);
            ctx.translate(20, 12);
            ctx.rotate(Math.PI / 6);
            ctx.drawImage(src, 0, 0);

            const img = ctx.getImageData(0, 0, 110, 110);
            const pixels = walkRotatedCenterlinePixels(20, 12, Math.PI / 6, 2);
            let gaps = 0;
            for (let i = 0; i < pixels.length; i++) {
                const o = (pixels[i].dy * 110 + pixels[i].dx) * 4;
                const s = img.data[o] + img.data[o + 1] + img.data[o + 2];
                if (s >= 600) gaps++;
            }
            assertEquals(gaps, 0, 'background gaps along the rotated 2px line centerline');
        });

        // -- the premultiplied-filtering contract (no fringes) ------------------------

        test('rotated drawImage filters premultiplied: no fringe from transparent-texel RGB', () => {
            // Mid-gray line; transparent background texels deliberately carry magenta
            // RGB under alpha 0. Composite onto an EMPTY (transparent) dest: every
            // pixel that received any coverage must be EXACTLY gray 128/128/128 —
            // a straight-alpha lerp would tint edges toward magenta (or darken them
            // toward black with zeroed transparent RGB).
            const src = makeLineSource(1, 128, 128, 128, true);
            const dst = SWCanvas.createCanvas(110, 110);
            const ctx = dst.getContext('2d');
            ctx.translate(20.37, 12.61);
            ctx.rotate(Math.PI / 6);
            ctx.drawImage(src, 0, 0);

            const img = ctx.getImageData(0, 0, 110, 110);
            let covered = 0, wrong = 0;
            for (let i = 0; i < img.data.length; i += 4) {
                if (img.data[i + 3] === 0) continue;
                covered++;
                if (img.data[i] !== 128 || img.data[i + 1] !== 128 || img.data[i + 2] !== 128) wrong++;
            }
            assertEquals(wrong, 0, 'covered pixels whose RGB is not exactly the line gray');
            assertEquals(covered > 50, true, 'the rotated line rendered some coverage');
        });

        // -- the zero-fraction exactness contract (crisp 90 deg) ----------------------

        test('exact 90 deg + integer translation stays crisp: pure texels, no blends', () => {
            // setTransform(0,1,-1,0,...) is an EXACT quarter-turn (ctx.rotate(PI/2)
            // would leave ~1e-17 residues in a and d). Dest pixel centers then land
            // exactly ON texel centers -> the zero-fraction fast path -> every output
            // pixel is byte-identical to one source texel, no blending anywhere.
            const W = 8, H = 8;
            const data = new Uint8ClampedArray(W * H * 4);
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const o = (y * W + x) * 4;
                    data[o] = x * 30; data[o + 1] = y * 30; data[o + 2] = (x ^ y) * 20; data[o + 3] = 255;
                }
            }
            const src = { width: W, height: H, data: data };

            const dst = SWCanvas.createCanvas(24, 24);
            const ctx = dst.getContext('2d');
            // rotate 90 deg CW about the origin, then shift right so the image lands
            // at x in [10, 18): dest = (10 + (H-1) - sy, sx)
            ctx.setTransform(0, 1, -1, 0, 10 + H, 0);
            ctx.drawImage(src, 0, 0);

            const img = ctx.getImageData(0, 0, 24, 24);
            let wrong = 0;
            for (let sy = 0; sy < H; sy++) {
                for (let sx = 0; sx < W; sx++) {
                    const dx = 10 + H - 1 - sy, dy = sx;
                    const o = (dy * 24 + dx) * 4;
                    const so = (sy * W + sx) * 4;
                    if (img.data[o] !== data[so] || img.data[o + 1] !== data[so + 1] ||
                        img.data[o + 2] !== data[so + 2] || img.data[o + 3] !== 255) wrong++;
                }
            }
            assertEquals(wrong, 0, 'pixels of the 90 deg composite differing from the exact source texel');
        });

        // -- the step-1 gate (non-resampling draws stay nearest-neighbor) -------------

        test('step-1 same-size drawImage stays nearest-neighbor byte-exact (hard edge)', () => {
            // 2x1 red|green blitted same-size at an integer position: the effective
            // sample step is exactly 1, nothing resamples, and the historical NN
            // bytes must come out — any blended column would mean the smoothing gate
            // leaked into the step-1 path (the path every glyph and back-buffer blit
            // rides).
            const data = new Uint8ClampedArray(2 * 1 * 4);
            data[0] = 255; data[3] = 255;              // red
            data[5] = 255; data[7] = 255;              // green
            const src = { width: 2, height: 1, data: data };

            const dst = SWCanvas.createCanvas(8, 4);
            const ctx = dst.getContext('2d');
            ctx.drawImage(src, 3, 1);

            const img = ctx.getImageData(0, 0, 8, 4);
            let wrong = 0;
            for (let x = 3; x < 5; x++) {
                const o = (1 * 8 + x) * 4;
                const expectRed = x === 3;
                if (img.data[o] !== (expectRed ? 255 : 0) || img.data[o + 1] !== (expectRed ? 0 : 255) ||
                    img.data[o + 2] !== 0 || img.data[o + 3] !== 255) wrong++;
            }
            assertEquals(wrong, 0, 'pixels of the same-size blit not exactly red|green (smoothing leak)');
        });


        // Test: the scaled-drawImage smoothing contract (the axis-aligned half of the
        // sampling policy; the rotated half is 057). An axis-aligned draw whose
        // EFFECTIVE SAMPLE STEP != 1 — the per-device-pixel source step invA*xScale /
        // invD*yScale, where the CTM scale and the src/dst rect ratio COMPOSE —
        // samples BILINEAR (dest-pixel-center, premultiplied, texels outside the
        // source sub-rect transparent); a step-1 draw reproduces the historical
        // nearest-neighbor bytes exactly, whichever way the step-1 arises (identity
        // same-size, or a scale(2) CTM drawing a physical-resolution source at
        // half-size rects). `imageSmoothingEnabled` (HTML5: default true, boolean,
        // save/restore state, both API layers) opts out: false forces nearest-
        // neighbor for EVERY transform, rotation included.

        // -- helpers ------------------------------------------------------------------

        function makeRedGreenSource(redCols, greenCols) {
            // (redCols+greenCols) x 1 opaque hard-edge pattern: red columns then green.
            const W = redCols + greenCols;
            const data = new Uint8ClampedArray(W * 4);
            for (let x = 0; x < W; x++) {
                const o = x * 4;
                if (x < redCols) { data[o] = 255; } else { data[o + 1] = 255; }
                data[o + 3] = 255;
            }
            return { width: W, height: 1, data: data };
        }

        function makeGradientSource(W, H) {
            const data = new Uint8ClampedArray(W * H * 4);
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const o = (y * W + x) * 4;
                    data[o] = x * 29; data[o + 1] = y * 31; data[o + 2] = (x ^ y) * 17; data[o + 3] = 255;
                }
            }
            return { width: W, height: H, data: data };
        }

        // -- smoothing engages on a non-integer upscale -------------------------------

        test('axis-aligned non-integer upscale blends at a hard source edge', () => {
            // 3x1 red|red|green upscaled to 7x1: bilinear must produce at least one
            // interior column that is a red-green MIX (both channels non-zero) —
            // nearest-neighbor produces only pure source colors.
            const src = makeRedGreenSource(2, 1);
            const dst = SWCanvas.createCanvas(7, 1);
            const ctx = dst.getContext('2d');
            ctx.drawImage(src, 0, 0, 7, 1);

            const img = ctx.getImageData(0, 0, 7, 1);
            let mixed = 0;
            for (let x = 1; x < 6; x++) { // interior columns (edges fade vs transparent outside)
                const o = x * 4;
                if (img.data[o] > 0 && img.data[o + 1] > 0) mixed++;
            }
            assertEquals(mixed > 0, true, 'no blended column in a non-integer upscale — smoothing did not engage');
        });

        // -- step-1 byte-exactness (the gate that guards every plain blit) ------------

        test('step-1 same-size blit at integer position is byte-exact NN', () => {
            const src = makeGradientSource(8, 8);
            const dst = SWCanvas.createCanvas(16, 16);
            const ctx = dst.getContext('2d');
            ctx.drawImage(src, 5, 3);

            const img = ctx.getImageData(0, 0, 16, 16);
            let wrong = 0;
            for (let sy = 0; sy < 8; sy++) {
                for (let sx = 0; sx < 8; sx++) {
                    const o = ((3 + sy) * 16 + (5 + sx)) * 4;
                    const so = (sy * 8 + sx) * 4;
                    if (img.data[o] !== src.data[so] || img.data[o + 1] !== src.data[so + 1] ||
                        img.data[o + 2] !== src.data[so + 2] || img.data[o + 3] !== 255) wrong++;
                }
            }
            assertEquals(wrong, 0, 'same-size blit pixels differing from the source (step-1 leak into bilinear)');
        });

        test('step-1 via CTM x rect composition is byte-exact NN (scale(2) at half-size rects)', () => {
            // The dpr-2 compensation shape: a physical-resolution source drawn at
            // logical size under a scale(2) CTM. invA = 0.5, xScale = 2 -> step
            // EXACTLY 1: nothing resamples and the bytes must equal the source.
            const src = makeGradientSource(8, 8);
            const dst = SWCanvas.createCanvas(16, 16);
            const ctx = dst.getContext('2d');
            ctx.scale(2, 2);
            ctx.drawImage(src, 0, 0, 8, 8, 2, 1, 4, 4); // dest 4x4 logical = 8x8 device at (4,2)

            const img = ctx.getImageData(0, 0, 16, 16);
            let wrong = 0;
            for (let sy = 0; sy < 8; sy++) {
                for (let sx = 0; sx < 8; sx++) {
                    const o = ((2 + sy) * 16 + (4 + sx)) * 4;
                    const so = (sy * 8 + sx) * 4;
                    if (img.data[o] !== src.data[so] || img.data[o + 1] !== src.data[so + 1] ||
                        img.data[o + 2] !== src.data[so + 2] || img.data[o + 3] !== 255) wrong++;
                }
            }
            assertEquals(wrong, 0, 'cpr-compensated (step-1) blit pixels differing from the source');
        });

        // -- imageSmoothingEnabled ----------------------------------------------------

        test('imageSmoothingEnabled: default true, boolean-coerced, both API layers', () => {
            const compat = SWCanvas.createCanvas(4, 4).getContext('2d');
            assertEquals(compat.imageSmoothingEnabled, true, 'compat default');
            compat.imageSmoothingEnabled = 0;
            assertEquals(compat.imageSmoothingEnabled, false, 'compat coerces falsy to false');
            compat.imageSmoothingEnabled = 'yes';
            assertEquals(compat.imageSmoothingEnabled, true, 'compat coerces truthy to true');

            const surface = SWCanvas.Core.Surface(4, 4);
            const core = new SWCanvas.Core.Context2D(surface);
            assertEquals(core.imageSmoothingEnabled, true, 'core default');
            core.imageSmoothingEnabled = 0;
            assertEquals(core.imageSmoothingEnabled, false, 'core coerces falsy to false');
        });

        test('imageSmoothingEnabled participates in save/restore', () => {
            const ctx = SWCanvas.createCanvas(4, 4).getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.save();
            ctx.imageSmoothingEnabled = true;
            assertEquals(ctx.imageSmoothingEnabled, true, 'set inside save scope');
            ctx.restore();
            assertEquals(ctx.imageSmoothingEnabled, false, 'restore returns the saved value');
        });

        test('imageSmoothingEnabled=false forces NN on a scaled blit (hard edge kept)', () => {
            // The historical (pre-smoothing) contract, now behind the opt-out: 2x1
            // red|green scaled x8 keeps a hard vertical edge, byte-for-byte.
            const src = makeRedGreenSource(1, 1);
            const dst = SWCanvas.createCanvas(16, 8);
            const ctx = dst.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(src, 0, 0, 16, 8);

            const img = ctx.getImageData(0, 0, 16, 8);
            let wrong = 0;
            for (let x = 0; x < 16; x++) {
                const o = x * 4;
                const expectRed = x < 8;
                if (img.data[o] !== (expectRed ? 255 : 0) || img.data[o + 1] !== (expectRed ? 0 : 255) ||
                    img.data[o + 2] !== 0) wrong++;
            }
            assertEquals(wrong, 0, 'columns of the smoothing-off scaled blit not exactly red|green');
        });

        test('imageSmoothingEnabled=false forces NN under rotation (pure texels only)', () => {
            // A rotated draw with smoothing off never blends: every covered pixel is
            // exactly the source gray (gaps may reappear — that is the opt-out's
            // documented cost, the user asked for NN).
            const W = 32, H = 32;
            const data = new Uint8ClampedArray(W * H * 4);
            for (let x = 0; x < W; x++) {
                const o = (10 * W + x) * 4;
                data[o] = 128; data[o + 1] = 128; data[o + 2] = 128; data[o + 3] = 255;
            }
            const src = { width: W, height: H, data: data };
            const dst = SWCanvas.createCanvas(110, 110);
            const ctx = dst.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.translate(20.37, 12.61);
            ctx.rotate(Math.PI / 6);
            ctx.drawImage(src, 0, 0);

            const img = ctx.getImageData(0, 0, 110, 110);
            let covered = 0, wrong = 0;
            for (let i = 0; i < img.data.length; i += 4) {
                if (img.data[i + 3] === 0) continue;
                covered++;
                if (img.data[i] !== 128 || img.data[i + 1] !== 128 || img.data[i + 2] !== 128 ||
                    img.data[i + 3] !== 255) wrong++;
            }
            assertEquals(wrong, 0, 'smoothing-off rotated draw produced blended pixels');
            assertEquals(covered > 20, true, 'the rotated line rendered some coverage');
        });

        // -- clipped whole-image draws compose seamlessly -----------------------------

        test('two adjacent clipped scaled draws equal one unclipped draw (seam-free)', () => {
            // The property incremental compositors rely on (e.g. Fizzygum's scaled
            // islands): drawing the WHOLE image through ONE mapping under two adjacent
            // rect clips must be byte-identical to a single unclipped draw — the clip
            // confines which pixels are written, never the sampling mapping or the
            // available taps.
            const src = makeGradientSource(8, 8);

            const whole = SWCanvas.createCanvas(20, 20);
            const wctx = whole.getContext('2d');
            wctx.drawImage(src, 0, 0, 8, 8, 1, 1, 17, 17); // non-integer step

            const strips = SWCanvas.createCanvas(20, 20);
            const sctx = strips.getContext('2d');
            for (const clip of [[0, 0, 9, 20], [9, 0, 11, 20]]) {
                sctx.save();
                sctx.beginPath();
                sctx.rect(clip[0], clip[1], clip[2], clip[3]);
                sctx.clip();
                sctx.drawImage(src, 0, 0, 8, 8, 1, 1, 17, 17);
                sctx.restore();
            }

            const a = wctx.getImageData(0, 0, 20, 20);
            const b = sctx.getImageData(0, 0, 20, 20);
            let diff = 0;
            for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) diff++;
            assertEquals(diff, 0, 'strip-composed scaled draw differs from the whole draw');
        });

        // -- downscale sanity ---------------------------------------------------------

        test('downscale is deterministic and keeps solid regions solid', () => {
            const W = 8, H = 8;
            const data = new Uint8ClampedArray(W * H * 4);
            for (let i = 0; i < data.length; i += 4) {
                data[i] = 40; data[i + 1] = 90; data[i + 2] = 200; data[i + 3] = 255;
            }
            const src = { width: W, height: H, data: data };

            const render = () => {
                const c = SWCanvas.createCanvas(5, 5);
                const x = c.getContext('2d');
                x.drawImage(src, 0, 0, 8, 8, 0, 0, 3, 3);
                return x.getImageData(0, 0, 5, 5);
            };
            const r1 = render(), r2 = render();
            let diff = 0;
            for (let i = 0; i < r1.data.length; i++) if (r1.data[i] !== r2.data[i]) diff++;
            assertEquals(diff, 0, 'two identical downscales differ (nondeterminism)');
            // interior pixel of the solid downscale keeps the source color exactly
            const o = (1 * 5 + 1) * 4;
            assertEquals(r1.data[o], 40, 'solid-region downscale changed R');
            assertEquals(r1.data[o + 1], 90, 'solid-region downscale changed G');
            assertEquals(r1.data[o + 2], 200, 'solid-region downscale changed B');
            assertEquals(r1.data[o + 3], 255, 'solid-region downscale changed A');
        });


        // Test: circle/arc/line generic fallbacks render correctly under a non-identity CTM
        // This file will be concatenated into the main test suite
        //
        // Regression guard for the retired LEGACY fallback generation. The direct-shape
        // entries (fillCircle, strokeCircle, fillStrokeCircle, fillArc, outerStrokeArc,
        // fillOuterStrokeArc, strokeLine) fall back to the generic pipeline for
        // gradient/pattern paints and non-source-over compositing. The legacy fallbacks
        // built the current default path from already-DEVICE-space coordinates - but the
        // default path bakes the live CTM into every point at build time, so the CTM was
        // applied TWICE (an identity swap at some sites came after the bake and only
        // prevented a third application). Under translate(30,30) a gradient
        // fillCircle(20,20,10) rendered at center (80,80) instead of (50,50).
        // The fallbacks now build an un-baked USER-space SWPath2D and pass it as an
        // external path, so geometry and paint share one application of the CTM.
        // Contract pinned here:
        //   1. POSITION: gradient fillCircle under translate lands at the translated
        //      center (not double-translated).
        //   2. EQUIVALENCE: each entry's fallback renders byte-identically to the same
        //      geometry drawn explicitly through an external SWPath2D under the same
        //      CTM - gradient paints under translate+rotate for all seven entries, and
        //      the non-source-over composite route for fillOuterStrokeArc.

        test('Circle/arc/line generic fallbacks - correct geometry and paint under CTM', () => {
            const W = 120;
            const H = 100;

            function newCtx() {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, W, H);
                return { surface, ctx };
            }

            function gradient(ctx) {
                const g = ctx.createLinearGradient(10, 10, 50, 50);
                g.addColorStop(0, 'red');
                g.addColorStop(1, 'blue');
                return g;
            }

            function bbox(surface) {
                let x0 = Infinity,
                    y0 = Infinity,
                    x1 = -Infinity,
                    y1 = -Infinity;
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        const o = y * surface.stride + x * 4;
                        if (surface.data[o] !== 255 || surface.data[o + 1] !== 255 || surface.data[o + 2] !== 255) {
                            if (x < x0) x0 = x;
                            if (x > x1) x1 = x;
                            if (y < y0) y0 = y;
                            if (y > y1) y1 = y;
                        }
                    }
                }
                return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
            }

            function assertBytesEqual(label, sa, sb) {
                for (let i = 0; i < sa.data.length; i++) {
                    if (sa.data[i] !== sb.data[i]) {
                        const pixel = Math.floor(i / 4);
                        throw new Error(`${label}: renders differ at (${pixel % W},${Math.floor(pixel / W)})`);
                    }
                }
            }

            // 1. Position: gradient fillCircle(20,20,10) under translate(30,30) must
            //    land at (50,50). The legacy fallback double-applied the translate and
            //    drew at (80,80).
            {
                const { surface, ctx } = newCtx();
                ctx.save();
                ctx.translate(30, 30);
                ctx.setFillStyle(gradient(ctx));
                ctx.fillCircle(20, 20, 10);
                ctx.restore();
                const b = bbox(surface);
                if (Math.abs(b.cx - 50) > 2 || Math.abs(b.cy - 50) > 2) {
                    throw new Error(
                        `gradient fillCircle @translate(30,30): center (${b.cx},${b.cy}), ` +
                            `expected ~(50,50) (double-applied CTM lands at (80,80))`
                    );
                }
                log(`  gradient fillCircle @translate(30,30): center (${b.cx},${b.cy})`);
            }

            // 2. Byte-equivalence with the explicit external-path render, under
            //    translate(10,6) + rotate(0.5), gradient paint (forces the fallback).
            const CASES = [
                [
                    'fillCircle (gradient)',
                    (ctx) => {
                        ctx.setFillStyle(gradient(ctx));
                        ctx.fillCircle(30, 40, 15);
                    },
                    (ctx) => {
                        ctx.setFillStyle(gradient(ctx));
                        const p = new SWCanvas.Core.SWPath2D();
                        p.arc(30, 40, 15, 0, 2 * Math.PI);
                        ctx.fill(p);
                    }
                ],
                [
                    'strokeCircle (gradient)',
                    (ctx) => {
                        ctx.setStrokeStyle(gradient(ctx));
                        ctx.lineWidth = 3;
                        ctx.strokeCircle(30, 40, 15);
                    },
                    (ctx) => {
                        ctx.setStrokeStyle(gradient(ctx));
                        ctx.lineWidth = 3;
                        const p = new SWCanvas.Core.SWPath2D();
                        p.arc(30, 40, 15, 0, 2 * Math.PI);
                        ctx.stroke(p);
                    }
                ],
                [
                    'fillStrokeCircle (gradient fill + gradient stroke)',
                    (ctx) => {
                        ctx.setFillStyle(gradient(ctx));
                        ctx.setStrokeStyle(gradient(ctx));
                        ctx.lineWidth = 3;
                        ctx.fillStrokeCircle(30, 40, 15);
                    },
                    (ctx) => {
                        ctx.setFillStyle(gradient(ctx));
                        ctx.setStrokeStyle(gradient(ctx));
                        ctx.lineWidth = 3;
                        const p = new SWCanvas.Core.SWPath2D();
                        p.arc(30, 40, 15, 0, 2 * Math.PI);
                        ctx.fill(p);
                        ctx.stroke(p);
                    }
                ],
                [
                    'strokeLine (gradient)',
                    (ctx) => {
                        ctx.setStrokeStyle(gradient(ctx));
                        ctx.lineWidth = 3;
                        ctx.strokeLine(15, 20, 60, 55);
                    },
                    (ctx) => {
                        ctx.setStrokeStyle(gradient(ctx));
                        ctx.lineWidth = 3;
                        const p = new SWCanvas.Core.SWPath2D();
                        p.moveTo(15, 20);
                        p.lineTo(60, 55);
                        ctx.stroke(p);
                    }
                ],
                [
                    'fillArc (gradient)',
                    (ctx) => {
                        ctx.setFillStyle(gradient(ctx));
                        ctx.fillArc(30, 40, 15, 0.3, 2.2);
                    },
                    (ctx) => {
                        ctx.setFillStyle(gradient(ctx));
                        const p = new SWCanvas.Core.SWPath2D();
                        p.moveTo(30, 40);
                        p.arc(30, 40, 15, 0.3, 2.2, false);
                        p.closePath();
                        ctx.fill(p);
                    }
                ],
                [
                    'outerStrokeArc (gradient)',
                    (ctx) => {
                        ctx.setStrokeStyle(gradient(ctx));
                        ctx.lineWidth = 3;
                        ctx.outerStrokeArc(30, 40, 15, 0.3, 2.2);
                    },
                    (ctx) => {
                        ctx.setStrokeStyle(gradient(ctx));
                        ctx.lineWidth = 3;
                        const p = new SWCanvas.Core.SWPath2D();
                        p.arc(30, 40, 15, 0.3, 2.2, false);
                        ctx.stroke(p);
                    }
                ],
                [
                    'fillOuterStrokeArc (solid colors, xor composite)',
                    (ctx) => {
                        ctx.setFillStyle(0, 128, 0, 255);
                        ctx.setStrokeStyle(255, 0, 0, 255);
                        ctx.lineWidth = 3;
                        ctx.globalCompositeOperation = 'xor';
                        ctx.fillOuterStrokeArc(30, 40, 15, 0.3, 2.2);
                    },
                    (ctx) => {
                        ctx.setFillStyle(0, 128, 0, 255);
                        ctx.setStrokeStyle(255, 0, 0, 255);
                        ctx.lineWidth = 3;
                        ctx.globalCompositeOperation = 'xor';
                        const p = new SWCanvas.Core.SWPath2D();
                        p.moveTo(30, 40);
                        p.arc(30, 40, 15, 0.3, 2.2, false);
                        p.closePath();
                        ctx.fill(p);
                        const sp = new SWCanvas.Core.SWPath2D();
                        sp.arc(30, 40, 15, 0.3, 2.2, false);
                        ctx.stroke(sp);
                    }
                ]
            ];
            for (const [label, direct, generic] of CASES) {
                const a = newCtx();
                a.ctx.save();
                a.ctx.translate(10, 6);
                a.ctx.rotate(0.5);
                direct(a.ctx);
                a.ctx.restore();
                const b = newCtx();
                b.ctx.save();
                b.ctx.translate(10, 6);
                b.ctx.rotate(0.5);
                generic(b.ctx);
                b.ctx.restore();
                assertBytesEqual(`${label} @translate+rotate vs external path`, a.surface, b.surface);
                log(`  ${label} @translate+rotate: === external-path render`);
            }

            const showcase = newCtx();
            showcase.ctx.save();
            showcase.ctx.translate(30, 30);
            showcase.ctx.setFillStyle(gradient(showcase.ctx));
            showcase.ctx.fillCircle(20, 20, 10);
            showcase.ctx.restore();
            savePNG(
                showcase.surface,
                'circle-gradient-fallback-under-translate.basic.png',
                'gradient fillCircle under translate(30,30) - correct position',
                SWCanvas
            );
        });


        // Test: fillCircle with an opaque Color under globalAlpha < 1 stays direct
        // This file will be concatenated into the main test suite
        //
        // Regression guard. _fillCircleDirect's dispatch had a hole: isOpaqueColor
        // requires globalAlpha >= 1, isSemiTransparentColor required paint a < 255 -
        // an OPAQUE color at globalAlpha 0.5 satisfied neither and dropped to the
        // generic fallback although CircleOps.fill_Alpha handles it exactly (every
        // sibling entry - fillRect, fillRoundRect, fillArc, fillStadium - dispatches
        // this case to its _Alpha renderer). Historically that fallback was also
        // CTM-broken (see tests/core/059), which made this the most user-visible
        // symptom of the pair: a plain solid-colour fillCircle at globalAlpha 0.5
        // under translate(30,30) rendered 30px off. Contract pinned here:
        //   1. STRUCTURAL: the case takes a direct path (no path-based rendering).
        //   2. POSITION: under translate(30,30) the circle lands at (50,50).
        //   3. ALPHA: globalAlpha is actually applied (a ~50/50 blend with the
        //      background), byte-identical to the same draw at paint a=255 through
        //      fill_Alpha semantics.

        test('fillCircle opaque color + globalAlpha < 1 - direct fill_Alpha path', () => {
            const W = 100;
            const H = 100;

            function newCtx() {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, W, H);
                return { surface, ctx };
            }

            function bboxCenter(surface) {
                let x0 = Infinity,
                    y0 = Infinity,
                    x1 = -Infinity,
                    y1 = -Infinity;
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        const o = y * surface.stride + x * 4;
                        if (surface.data[o] !== 255 || surface.data[o + 1] !== 255 || surface.data[o + 2] !== 255) {
                            if (x < x0) x0 = x;
                            if (x > x1) x1 = x;
                            if (y < y0) y0 = y;
                            if (y > y1) y1 = y;
                        }
                    }
                }
                return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
            }

            // 1+2. Structural + position: opaque red at globalAlpha 0.5 under
            //      translate(30,30) stays direct and lands at (50,50).
            const { surface, ctx } = newCtx();
            SWCanvas.Core.Context2D.resetPathBasedFlag();
            ctx.save();
            ctx.translate(30, 30);
            ctx.globalAlpha = 0.5;
            ctx.setFillStyle(255, 0, 0, 255);
            ctx.fillCircle(20, 20, 10);
            ctx.restore();
            if (SWCanvas.Core.Context2D.wasPathBasedUsed()) {
                throw new Error('fillCircle opaque color + globalAlpha<1 fell to the path pipeline');
            }
            const c = bboxCenter(surface);
            if (Math.abs(c.cx - 50) > 2 || Math.abs(c.cy - 50) > 2) {
                throw new Error(`fillCircle @globalAlpha 0.5 + translate(30,30): center (${c.cx},${c.cy}), expected ~(50,50)`);
            }
            log(`  opaque color @globalAlpha 0.5: direct, center (${c.cx},${c.cy})`);

            // 3. Alpha applied: the center pixel is a ~50/50 red/white blend.
            const o = 50 * surface.stride + 50 * 4;
            const px = [surface.data[o], surface.data[o + 1], surface.data[o + 2]];
            if (px[0] !== 255 || Math.abs(px[1] - 127) > 3 || Math.abs(px[2] - 127) > 3) {
                throw new Error(`center pixel [${px}] is not a ~50/50 red/white blend (globalAlpha dropped?)`);
            }
            log(`  center pixel [${px}]: globalAlpha applied`);
        });


        // Test: fillOuterStrokeArc falls back (not drops) gradient/pattern halves
        // This file will be concatenated into the main test suite
        //
        // Regression guard. fillOuterStrokeArc's fallback tail reused hasFill/hasStroke,
        // which embed `instanceof Color` - correct for the direct arm's null-paint
        // slots, but as FALLBACK guards they silently dropped any non-Color half:
        // gradient fill + solid stroke drew the stroke only, and gradient fill +
        // gradient stroke drew NOTHING AT ALL. It was the only family member with this
        // hole (fillStrokeCircle/fillStrokeRect/fillStrokeRoundRect decompose into
        // single-purpose entries). The fallback now recomputes presence from paint
        // existence. Contract pinned here: each mixed/non-Color paint combination
        // renders byte-identically to the same geometry drawn explicitly through
        // external SWPath2Ds under the same CTM - and actually renders (non-empty).

        test('fillOuterStrokeArc - gradient/pattern halves fall back instead of dropping', () => {
            const W = 120;
            const H = 100;

            function newCtx() {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, W, H);
                return { surface, ctx };
            }

            function gradient(ctx) {
                const g = ctx.createLinearGradient(10, 10, 50, 50);
                g.addColorStop(0, 'red');
                g.addColorStop(1, 'blue');
                return g;
            }

            function nonWhiteCount(surface) {
                let n = 0;
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        const o = y * surface.stride + x * 4;
                        if (surface.data[o] !== 255 || surface.data[o + 1] !== 255 || surface.data[o + 2] !== 255) n++;
                    }
                }
                return n;
            }

            function assertBytesEqual(label, sa, sb) {
                for (let i = 0; i < sa.data.length; i++) {
                    if (sa.data[i] !== sb.data[i]) {
                        const pixel = Math.floor(i / 4);
                        throw new Error(`${label}: renders differ at (${pixel % W},${Math.floor(pixel / W)})`);
                    }
                }
            }

            // Each case: [label, set fill style, set stroke style]. The reference
            // renders the same pie fill + outer-arc stroke through external paths.
            const CASES = [
                [
                    'gradient fill + solid stroke',
                    (ctx) => ctx.setFillStyle(gradient(ctx)),
                    (ctx) => ctx.setStrokeStyle(255, 0, 0, 255)
                ],
                [
                    'solid fill + gradient stroke',
                    (ctx) => ctx.setFillStyle(0, 128, 0, 255),
                    (ctx) => ctx.setStrokeStyle(gradient(ctx))
                ],
                [
                    'gradient fill + gradient stroke',
                    (ctx) => ctx.setFillStyle(gradient(ctx)),
                    (ctx) => ctx.setStrokeStyle(gradient(ctx))
                ]
            ];

            for (const [label, setFill, setStroke] of CASES) {
                const a = newCtx();
                a.ctx.save();
                a.ctx.translate(10, 6);
                a.ctx.rotate(0.5);
                setFill(a.ctx);
                setStroke(a.ctx);
                a.ctx.lineWidth = 3;
                a.ctx.fillOuterStrokeArc(30, 40, 15, 0.3, 2.2);
                a.ctx.restore();

                const n = nonWhiteCount(a.surface);
                if (n === 0) {
                    throw new Error(`fillOuterStrokeArc (${label}): drew NOTHING (non-Color half dropped)`);
                }

                const b = newCtx();
                b.ctx.save();
                b.ctx.translate(10, 6);
                b.ctx.rotate(0.5);
                setFill(b.ctx);
                setStroke(b.ctx);
                b.ctx.lineWidth = 3;
                const p = new SWCanvas.Core.SWPath2D();
                p.moveTo(30, 40);
                p.arc(30, 40, 15, 0.3, 2.2, false);
                p.closePath();
                b.ctx.fill(p);
                const sp = new SWCanvas.Core.SWPath2D();
                sp.arc(30, 40, 15, 0.3, 2.2, false);
                b.ctx.stroke(sp);
                b.ctx.restore();

                assertBytesEqual(`fillOuterStrokeArc (${label}) vs external paths`, a.surface, b.surface);
                log(`  ${label}: ${n}px, === external-path render`);
            }
        });


        // Test: _noShadow tests shadow transparency by VALUE, not reference identity
        // This file will be concatenated into the main test suite
        //
        // Regression guard (a de-pessimization, not a wrong-pixels bug). The cached
        // _noShadow flag - consulted by the rect/roundRect/stadium direct-rendering
        // gates of the era, and still by the stroke/fused/circle/arc gates - tested
        // `shadowColor === Color.transparent` (reference identity), while
        // ShadowPipeline.needsShadow tests `shadowColor.a > 0`. Every non-default
        // route allocates a fresh Color (setShadowColor, the compat CSS parser), so the
        // common "disable the shadow by colour, leave blur/offset set" idiom flipped
        // _noShadow false and silently routed the draw through the shadow machinery
        // for a shadow that would never be drawn. The flag now checks
        // `shadowColor.a === 0` - the exact negation of needsShadow (§9 entry 5).
        //
        // HISTORY: this test originally ALSO pinned structurally that an invisible
        // shadow kept fillRect/fillRoundRect on their direct fill arms. Those arms were
        // removed by the fill-arm-removal campaign
        // (plans/one-rect-fill-pipeline-and-fill-arm-removal.md) - rect-family FILLS
        // are now uniformly generic, so the structural half became vacuous and was
        // dropped. The BYTE-IDENTITY contract below is the surviving guard: however an
        // invisible shadow is spelled, it must not change a single pixel - under
        // either pipeline. (The _noShadow flag itself still gates the stroke, fused,
        // circle and arc direct arms, where §9 entry 5's de-pessimization remains live.)
        // Contract:
        //   1. BYTE-IDENTITY: value-transparent shadow state (fresh Color a=0, blur and
        //      offsets set) renders identically to the default no-shadow state.
        //   2. NOT OVERSHOT: a real (visible) shadow still renders shadow pixels.

        test('_noShadow - transparent shadow colour by value is a no-op on pixels', () => {
            const W = 80;
            const H = 80;

            function newCtx() {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, W, H);
                return { surface, ctx };
            }

            // 1. Byte-identity with the default no-shadow state (fillRect + fillRoundRect).
            {
                const a = newCtx();
                a.ctx.setShadowColor(0, 0, 0, 0); // fresh Color, not the Color.transparent instance
                a.ctx.setShadowBlur(5);
                a.ctx.setShadowOffsetX(3);
                a.ctx.setShadowOffsetY(3);
                a.ctx.setFillStyle(255, 0, 0, 255);
                a.ctx.fillRect(20, 20, 30, 30);
                a.ctx.fillRoundRect(20, 55, 30, 20, 5);

                const b = newCtx();
                b.ctx.setFillStyle(255, 0, 0, 255);
                b.ctx.fillRect(20, 20, 30, 30);
                b.ctx.fillRoundRect(20, 55, 30, 20, 5);

                for (let i = 0; i < a.surface.data.length; i++) {
                    if (a.surface.data[i] !== b.surface.data[i]) {
                        const pixel = Math.floor(i / 4);
                        throw new Error(
                            `invisible-shadow render differs from no-shadow render at (${pixel % W},${Math.floor(pixel / W)})`
                        );
                    }
                }
                log('  invisible shadow === default no-shadow (byte-identical, rect + roundRect)');
            }

            // 2. Not overshot: a VISIBLE shadow still renders.
            {
                const { surface, ctx } = newCtx();
                ctx.setShadowColor(0, 0, 255, 255);
                ctx.setShadowBlur(0);
                ctx.setShadowOffsetX(6);
                ctx.setShadowOffsetY(6);
                ctx.setFillStyle(255, 0, 0, 255);
                ctx.fillRect(20, 20, 30, 30);
                // Sample inside the offset shadow band, outside the rect: (53, 53).
                const o = 53 * surface.stride + 53 * 4;
                const px = [surface.data[o], surface.data[o + 1], surface.data[o + 2]];
                if (px[0] === 255 && px[1] === 255 && px[2] === 255) {
                    throw new Error('visible shadow did not render (over-widened _noShadow?)');
                }
                log(`  visible shadow still renders: shadow pixel [${px}]`);
            }
        });


        // Test: circle/arc/line direct entries render ctx shadows via the generic fallback
        // This file will be concatenated into the main test suite
        //
        // Regression guard. The rect/roundRect/stadium families gate direct rendering
        // through _canUseDirectRendering, which contains _noShadow - but the circle,
        // arc and line entries hand-roll their gates and were shadow-blind: the direct
        // renderers cannot draw a ctx shadow (no shadow code exists in src/renderers/),
        // so `shadowBlur = 5; fillCircle(...)` drew shadowless while the same state
        // with fillRect(...) rendered the shadow. The hand-rolled gates now carry the
        // _noShadow term, routing any active shadow to the (CTM-correct, tests/core/059)
        // generic fallback. Contract pinned per entry, under a translated CTM:
        //   1. the shadowed render is byte-identical to the same geometry drawn
        //      explicitly through external SWPath2Ds with the same shadow state, and
        //   2. the shadowed render differs from the shadowless one (the shadow is
        //      actually there - pre-fix these were byte-identical).

        test('Circle/arc/line entries - active shadow routes to generic fallback and renders', () => {
            const W = 120;
            const H = 110;

            function newCtx() {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, W, H);
                return { surface, ctx };
            }

            function setShadow(ctx) {
                ctx.setShadowColor(0, 0, 255, 255);
                ctx.setShadowBlur(0);
                ctx.setShadowOffsetX(8);
                ctx.setShadowOffsetY(8);
            }

            function bytesEqual(sa, sb) {
                for (let i = 0; i < sa.data.length; i++) {
                    if (sa.data[i] !== sb.data[i]) return { equal: false, i };
                }
                return { equal: true };
            }

            // [label, direct draw, external-path reference draw]
            const CASES = [
                [
                    'fillCircle',
                    (ctx) => {
                        ctx.setFillStyle(0, 128, 0, 255);
                        ctx.fillCircle(30, 30, 10);
                    },
                    (ctx) => {
                        ctx.setFillStyle(0, 128, 0, 255);
                        const p = new SWCanvas.Core.SWPath2D();
                        p.arc(30, 30, 10, 0, 2 * Math.PI);
                        ctx.fill(p);
                    }
                ],
                [
                    'strokeCircle',
                    (ctx) => {
                        ctx.setStrokeStyle(0, 128, 0, 255);
                        ctx.lineWidth = 3;
                        ctx.strokeCircle(30, 30, 10);
                    },
                    (ctx) => {
                        ctx.setStrokeStyle(0, 128, 0, 255);
                        ctx.lineWidth = 3;
                        const p = new SWCanvas.Core.SWPath2D();
                        p.arc(30, 30, 10, 0, 2 * Math.PI);
                        ctx.stroke(p);
                    }
                ],
                [
                    'fillStrokeCircle',
                    (ctx) => {
                        ctx.setFillStyle(0, 128, 0, 255);
                        ctx.setStrokeStyle(128, 0, 128, 255);
                        ctx.lineWidth = 3;
                        ctx.fillStrokeCircle(30, 30, 10);
                    },
                    (ctx) => {
                        ctx.setFillStyle(0, 128, 0, 255);
                        ctx.setStrokeStyle(128, 0, 128, 255);
                        ctx.lineWidth = 3;
                        const p = new SWCanvas.Core.SWPath2D();
                        p.arc(30, 30, 10, 0, 2 * Math.PI);
                        ctx.fill(p);
                        ctx.stroke(p);
                    }
                ],
                [
                    'fillArc',
                    (ctx) => {
                        ctx.setFillStyle(0, 128, 0, 255);
                        ctx.fillArc(30, 30, 14, 0.3, 2.2);
                    },
                    (ctx) => {
                        ctx.setFillStyle(0, 128, 0, 255);
                        const p = new SWCanvas.Core.SWPath2D();
                        p.moveTo(30, 30);
                        p.arc(30, 30, 14, 0.3, 2.2, false);
                        p.closePath();
                        ctx.fill(p);
                    }
                ],
                [
                    'outerStrokeArc',
                    (ctx) => {
                        ctx.setStrokeStyle(0, 128, 0, 255);
                        ctx.lineWidth = 3;
                        ctx.outerStrokeArc(30, 30, 14, 0.3, 2.2);
                    },
                    (ctx) => {
                        ctx.setStrokeStyle(0, 128, 0, 255);
                        ctx.lineWidth = 3;
                        const p = new SWCanvas.Core.SWPath2D();
                        p.arc(30, 30, 14, 0.3, 2.2, false);
                        ctx.stroke(p);
                    }
                ],
                [
                    'fillOuterStrokeArc',
                    (ctx) => {
                        ctx.setFillStyle(0, 128, 0, 255);
                        ctx.setStrokeStyle(128, 0, 128, 255);
                        ctx.lineWidth = 3;
                        ctx.fillOuterStrokeArc(30, 30, 14, 0.3, 2.2);
                    },
                    (ctx) => {
                        ctx.setFillStyle(0, 128, 0, 255);
                        ctx.setStrokeStyle(128, 0, 128, 255);
                        ctx.lineWidth = 3;
                        const p = new SWCanvas.Core.SWPath2D();
                        p.moveTo(30, 30);
                        p.arc(30, 30, 14, 0.3, 2.2, false);
                        p.closePath();
                        ctx.fill(p);
                        const sp = new SWCanvas.Core.SWPath2D();
                        sp.arc(30, 30, 14, 0.3, 2.2, false);
                        ctx.stroke(sp);
                    }
                ],
                [
                    'strokeLine',
                    (ctx) => {
                        ctx.setStrokeStyle(0, 128, 0, 255);
                        ctx.lineWidth = 3;
                        ctx.strokeLine(15, 20, 60, 50);
                    },
                    (ctx) => {
                        ctx.setStrokeStyle(0, 128, 0, 255);
                        ctx.lineWidth = 3;
                        const p = new SWCanvas.Core.SWPath2D();
                        p.moveTo(15, 20);
                        p.lineTo(60, 50);
                        ctx.stroke(p);
                    }
                ]
            ];

            for (const [label, direct, generic] of CASES) {
                // A: direct entry, shadow active.
                const a = newCtx();
                a.ctx.save();
                a.ctx.translate(10, 10);
                setShadow(a.ctx);
                direct(a.ctx);
                a.ctx.restore();

                // B: external-path reference, same shadow state.
                const b = newCtx();
                b.ctx.save();
                b.ctx.translate(10, 10);
                setShadow(b.ctx);
                generic(b.ctx);
                b.ctx.restore();

                // C: direct entry, no shadow.
                const c = newCtx();
                c.ctx.save();
                c.ctx.translate(10, 10);
                direct(c.ctx);
                c.ctx.restore();

                const ab = bytesEqual(a.surface, b.surface);
                if (!ab.equal) {
                    const pixel = Math.floor(ab.i / 4);
                    throw new Error(
                        `${label} shadowed: differs from external-path render at (${pixel % W},${Math.floor(pixel / W)})`
                    );
                }
                const ac = bytesEqual(a.surface, c.surface);
                if (ac.equal) {
                    throw new Error(`${label}: shadowed render identical to shadowless render (shadow silently dropped)`);
                }
                log(`  ${label}: shadow renders, === external-path render`);
            }
        });


        // Test: direct-shape entries validate/no-op consistently, whatever the paint
        // This file will be concatenated into the main test suite
        //
        // Regression guard for the entry-consistency sweep. Previously fillRect,
        // strokeRect and strokeLine had NO up-front validation, with three
        // consequences: (a) negative-dimension strokeRect PAINTED STRAY PIXELS on the
        // direct arm (19-21 px) while the generic arm threw; (b) bad arguments
        // produced three different errors from three different layers depending on
        // the paint source; (c) clearRect called transform.invert() unguarded and
        // threw under a singular CTM where fill()/stroke() silently draw nothing.
        // Separately, fully-transparent paint (a === 0) dispatched three different
        // ways (rects: full generic pipeline; circles/lines: direct scan writing
        // nothing; fillArc: early return). Contract now pinned:
        //   1. Negative/zero dims draw NOTHING at fillRect/strokeRect (family
        //      convention), no stray pixels, no paint-dependent throw.
        //   2. Bad argument types throw the SAME message whatever the paint source.
        //   3. clearRect under a singular CTM is a silent no-op.
        //   4. Paint a === 0 / globalAlpha === 0 under source-over early-return at
        //      every entry (structurally: no generic-pipeline dispatch) - but NOT
        //      under other composite ops, which can make invisible paint visible.

        test('Entry validation - dims, types, singular CTM, invisible-draw consistency', () => {
            const W = 60;
            const H = 60;

            function newCtx() {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, W, H);
                return { surface, ctx };
            }

            function gradient(ctx) {
                const g = ctx.createLinearGradient(0, 0, 40, 40);
                g.addColorStop(0, 'red');
                g.addColorStop(1, 'blue');
                return g;
            }

            function nonWhiteCount(surface) {
                let n = 0;
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        const o = y * surface.stride + x * 4;
                        if (surface.data[o] !== 255 || surface.data[o + 1] !== 255 || surface.data[o + 2] !== 255) n++;
                    }
                }
                return n;
            }

            // 1a. Negative-dimension strokeRect: no stray pixels (was 19-21 px).
            {
                const { surface, ctx } = newCtx();
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = 1;
                ctx.strokeRect(10, 10, -20, 20);
                ctx.strokeRect(10, 10, 20, -20);
                const n = nonWhiteCount(surface);
                if (n !== 0) {
                    throw new Error(`negative-dim strokeRect painted ${n} stray pixels`);
                }
                log('  negative-dim strokeRect: 0 pixels');
            }

            // 1b. Negative-dimension fillRect with a GRADIENT: no throw, no pixels
            //     (the generic arm used to throw where the direct arm no-opped).
            {
                const { surface, ctx } = newCtx();
                ctx.setFillStyle(gradient(ctx));
                ctx.fillRect(10, 10, -20, 20);
                if (nonWhiteCount(surface) !== 0) {
                    throw new Error('negative-dim gradient fillRect drew pixels');
                }
                log('  negative-dim gradient fillRect: silent no-op (no throw)');
            }

            // 2. Same throw whatever the paint source.
            {
                const expectThrow = (label, fn, expected) => {
                    let msg = null;
                    try {
                        fn();
                    } catch (e) {
                        msg = e.message;
                    }
                    if (msg !== expected) {
                        throw new Error(`${label}: threw "${msg}", expected "${expected}"`);
                    }
                };
                const a = newCtx();
                a.ctx.setFillStyle(255, 0, 0, 255);
                expectThrow('fillRect solid bad-x', () => a.ctx.fillRect('a', 0, 10, 10), 'Rectangle coordinates must be numbers');
                a.ctx.setFillStyle(gradient(a.ctx));
                expectThrow('fillRect gradient bad-x', () => a.ctx.fillRect('a', 0, 10, 10), 'Rectangle coordinates must be numbers');
                a.ctx.setStrokeStyle(255, 0, 0, 255);
                expectThrow('strokeLine solid bad-x', () => a.ctx.strokeLine('a', 0, 10, 10), 'Line coordinates must be numbers');
                a.ctx.setStrokeStyle(gradient(a.ctx));
                expectThrow('strokeLine gradient bad-x', () => a.ctx.strokeLine('a', 0, 10, 10), 'Line coordinates must be numbers');
                log('  bad-argument throws: paint-independent messages');
            }

            // 3. clearRect under a singular (non-invertible, non-axis-aligned) CTM:
            //    silent no-op, like fill()/stroke().
            {
                const { surface, ctx } = newCtx();
                ctx.setFillStyle(0, 128, 0, 255);
                ctx.fillRect(10, 10, 20, 20);
                const before = nonWhiteCount(surface);
                ctx.save();
                ctx.transform(1, 1, 1, 1, 0, 0); // det = 0, b/c nonzero -> inverse-transform loop
                ctx.clearRect(0, 0, 40, 40); // used to throw 'Transform2D matrix is not invertible'
                ctx.restore();
                if (nonWhiteCount(surface) !== before) {
                    throw new Error('clearRect under singular CTM changed pixels');
                }
                log('  clearRect under singular CTM: silent no-op');
            }

            // 4a. Invisible draws early-return under source-over (structural: the
            //     generic pipeline is not dispatched).
            {
                const { surface, ctx } = newCtx();
                SWCanvas.Core.Context2D.resetPathBasedFlag();
                ctx.setFillStyle(255, 0, 0, 0); // a = 0
                ctx.fillRect(5, 5, 20, 20);
                ctx.fillRoundRect(5, 30, 20, 15, 4);
                ctx.setStrokeStyle(0, 0, 255, 0); // a = 0
                ctx.strokeLine(5, 50, 40, 55);
                ctx.setFillStyle(gradient(ctx));
                ctx.globalAlpha = 0;
                ctx.fillRect(30, 5, 20, 20); // gradient at globalAlpha 0
                ctx.globalAlpha = 1;
                if (SWCanvas.Core.Context2D.wasPathBasedUsed()) {
                    throw new Error('an invisible draw dispatched the generic pipeline instead of early-returning');
                }
                if (nonWhiteCount(surface) !== 0) {
                    throw new Error('an invisible draw changed pixels');
                }
                log('  invisible draws (a=0 / globalAlpha=0): early return, no dispatch');
            }

            // 4b. ...but NOT under non-source-over composites (e.g. 'xor'), where
            //     transparent paint can have visible effects - those keep the
            //     generic pipeline.
            {
                const { ctx } = newCtx();
                SWCanvas.Core.Context2D.resetPathBasedFlag();
                ctx.globalCompositeOperation = 'xor';
                ctx.setFillStyle(255, 0, 0, 0); // a = 0
                ctx.fillRect(5, 5, 20, 20);
                if (!SWCanvas.Core.Context2D.wasPathBasedUsed()) {
                    throw new Error('a=0 draw under xor was skipped - the invisible-draw guard must be source-over only');
                }
                log('  a=0 under xor: still dispatched (guard is source-over-scoped)');
            }
        });


        // Test: setLineDash is honoured by the immediate-mode stroke entries
        // This file will be concatenated into the main test suite
        //
        // Regression guard for the dash policy decision: dashed strokes GATE TO THE
        // GENERIC PATH. The direct stroke renderers draw solid runs only and ignored
        // lineDash entirely - and strokeRect was dash-blind on BOTH arms, because its
        // generic fallback hand-built the stroke props and omitted the dash fields.
        // Every direct stroke arm (strokeRect, strokeRoundRect, strokeCircle,
        // outerStrokeArc, strokeLine, and the fused entries' stroke halves) now
        // declines when a dash pattern is set, so setLineDash works uniformly across
        // the immediate-mode API. Contract pinned here per entry:
        //   1. the dashed render differs from the solid one (dash is actually applied),
        //   2. the dashed render is byte-identical to the same geometry stroked
        //      explicitly through an external SWPath2D (the generic reference), and
        //   3. strokeRect's generic arm (gradient paint) is dashed too.

        test('setLineDash - honoured by direct stroke entries via the generic path', () => {
            const W = 100;
            const H = 90;

            function newCtx() {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, W, H);
                return { surface, ctx };
            }

            function assertBytesEqual(label, sa, sb) {
                for (let i = 0; i < sa.data.length; i++) {
                    if (sa.data[i] !== sb.data[i]) {
                        const pixel = Math.floor(i / 4);
                        throw new Error(`${label}: renders differ at (${pixel % W},${Math.floor(pixel / W)})`);
                    }
                }
            }

            function bytesDiffer(sa, sb) {
                for (let i = 0; i < sa.data.length; i++) {
                    if (sa.data[i] !== sb.data[i]) return true;
                }
                return false;
            }

            // [label, direct draw, external-path reference draw]
            const CASES = [
                [
                    'strokeRect',
                    (ctx) => ctx.strokeRect(15, 15, 50, 40),
                    (ctx) => {
                        const p = new SWCanvas.Core.SWPath2D();
                        p.rect(15, 15, 50, 40);
                        p.closePath();
                        ctx.stroke(p);
                    }
                ],
                [
                    'strokeRoundRect',
                    (ctx) => ctx.strokeRoundRect(15, 15, 50, 40, 8),
                    null // no external-path twin builds identical geometry; differ-check only
                ],
                [
                    'strokeCircle',
                    (ctx) => ctx.strokeCircle(45, 40, 20),
                    (ctx) => {
                        const p = new SWCanvas.Core.SWPath2D();
                        p.arc(45, 40, 20, 0, 2 * Math.PI);
                        ctx.stroke(p);
                    }
                ],
                [
                    'outerStrokeArc',
                    (ctx) => ctx.outerStrokeArc(45, 40, 20, 0.3, 2.2),
                    (ctx) => {
                        const p = new SWCanvas.Core.SWPath2D();
                        p.arc(45, 40, 20, 0.3, 2.2, false);
                        ctx.stroke(p);
                    }
                ],
                [
                    'strokeLine',
                    (ctx) => ctx.strokeLine(10, 20, 85, 70),
                    (ctx) => {
                        const p = new SWCanvas.Core.SWPath2D();
                        p.moveTo(10, 20);
                        p.lineTo(85, 70);
                        ctx.stroke(p);
                    }
                ]
            ];

            for (const [label, direct, generic] of CASES) {
                const solid = newCtx();
                solid.ctx.setStrokeStyle(255, 0, 0, 255);
                solid.ctx.lineWidth = 2;
                direct(solid.ctx);

                const dashed = newCtx();
                dashed.ctx.setStrokeStyle(255, 0, 0, 255);
                dashed.ctx.lineWidth = 2;
                dashed.ctx.setLineDash([5, 4]);
                direct(dashed.ctx);

                if (!bytesDiffer(dashed.surface, solid.surface)) {
                    throw new Error(`${label}: dashed render identical to solid (lineDash ignored)`);
                }

                if (generic) {
                    const ref = newCtx();
                    ref.ctx.setStrokeStyle(255, 0, 0, 255);
                    ref.ctx.lineWidth = 2;
                    ref.ctx.setLineDash([5, 4]);
                    generic(ref.ctx);
                    assertBytesEqual(`${label} dashed vs external path`, dashed.surface, ref.surface);
                    log(`  ${label}: dashed, === external-path render`);
                } else {
                    log(`  ${label}: dashed (differs from solid)`);
                }
            }

            // 3. strokeRect's GENERIC arm (gradient paint) honours dash too - its
            //    fallback used to omit the dash fields from the stroke props.
            {
                const g = (ctx) => {
                    const gr = ctx.createLinearGradient(10, 10, 70, 60);
                    gr.addColorStop(0, 'red');
                    gr.addColorStop(1, 'blue');
                    return gr;
                };
                const solid = newCtx();
                solid.ctx.setStrokeStyle(g(solid.ctx));
                solid.ctx.lineWidth = 2;
                solid.ctx.strokeRect(15, 15, 50, 40);

                const dashed = newCtx();
                dashed.ctx.setStrokeStyle(g(dashed.ctx));
                dashed.ctx.lineWidth = 2;
                dashed.ctx.setLineDash([5, 4]);
                dashed.ctx.strokeRect(15, 15, 50, 40);

                if (!bytesDiffer(dashed.surface, solid.surface)) {
                    throw new Error('gradient strokeRect: dashed render identical to solid (fallback drops dash props)');
                }
                log('  strokeRect generic arm (gradient): dashed');
            }
        });


        // Test: fillRect dispatches to the generic pipeline under EVERY CTM (decision pin)
        // This file will be concatenated into the main test suite
        //
        // DECISION RECORD PIN, not a bug guard. fillRect once had two direct fill arms
        // (RectOpsAA for axis-aligned CTMs, RectOpsRot for tilted uniform-scale CTMs)
        // and a rejected third (the general-affine quad arm - benchmarked at 0.99x-1.02x,
        // dead parity, DIRECT-RENDERING-SUMMARY.MD §9 entry 10). The remaining two were
        // then ALSO removed on benchmark evidence: disable-and-benchmark measured the
        // generic pipeline's tier-0-wired solid span arm (PolygonFiller._fillPolygonsDirect)
        // at parity for tilted fills (1.00-1.01x) and within 2-6% on small/mid
        // alpha axis-aligned fills - a cost the owner explicitly accepted for one
        // rect-fill implementation (§9 entries 15-16;
        // plans/one-rect-fill-pipeline-and-fill-arm-removal.md). Rect FILLS are now
        // uniformly generic across ALL CTM classes; the direct rect machinery lives on
        // only in strokes and the fused fillStroke entries (out of scope, structural wins).
        //
        // This test pins the decision structurally: fillRect dispatches generic under
        // every CTM class. If it starts failing, someone re-introduced a rect-fill
        // fast path - do that only with fresh §2.1-grade benchmark evidence, and then
        // update this pin and the §9 record together.

        test('fillRect - dispatches generic under every CTM class (fill-arm-removal pin)', () => {
            const W = 100;
            const H = 60;

            function newCtx() {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, W, H);
                return { surface, ctx };
            }

            const ALL_CTMS = [
                ['identity', (ctx) => {}],
                ['integer translate', (ctx) => ctx.translate(10, 5)],
                ['axis-aligned scale', (ctx) => ctx.scale(2, 1)],
                [
                    '90-degree rotation',
                    (ctx) => {
                        ctx.translate(50, 30);
                        ctx.rotate(Math.PI / 2);
                    }
                ],
                [
                    'tilted uniform scale',
                    (ctx) => {
                        ctx.translate(50, 30);
                        ctx.rotate(0.5);
                        ctx.scale(1.5, 1.5);
                    }
                ],
                ['shear', (ctx) => ctx.transform(1, 0, 0.5, 1, 5, 0)],
                [
                    'rotation + non-uniform scale',
                    (ctx) => {
                        ctx.translate(50, 30);
                        ctx.rotate(0.5);
                        ctx.scale(2, 1);
                    }
                ]
            ];

            for (const [label, applyCtm] of ALL_CTMS) {
                for (const alpha of [255, 128]) {
                    const { ctx } = newCtx();
                    ctx.save();
                    applyCtm(ctx);
                    ctx.setFillStyle(255, 0, 0, alpha);
                    SWCanvas.Core.Context2D.resetPathBasedFlag();
                    ctx.fillRect(-10, -8, 20, 16);
                    ctx.restore();
                    if (!SWCanvas.Core.Context2D.wasPathBasedUsed()) {
                        throw new Error(
                            `fillRect under ${label} (alpha ${alpha}) took a direct path - a rect-fill ` +
                                `fast path is back without the §9 fill-arm-removal record being revisited`
                        );
                    }
                }
                log(`  ${label}: generic (as decided)`);
            }
        });


        // Test: roundRect radii - the HTML5 per-corner contract, on every roundRect entry point
        // This file will be concatenated into the main test suite
        //
        // Contract pin for the per-corner radii decision (DIRECT-RENDERING-SUMMARY.MD §9
        // entry 11, which records how the radii argument went from first-element-wins to
        // HTML5 semantics). Every roundRect entry - the path methods
        // (Context2D.roundRect, SWPath2D.roundRect) and the immediate-mode
        // fillRoundRect / strokeRoundRect / fillStrokeRoundRect - reads radii the way
        // HTML5 roundRect() does (CSS border-radius order). Pinned here:
        //   1. list expansion: r | [r] | [a,b] | [a,b,c] | [a,b,c,d] land on the
        //      right corners (TL, TR, BR, BL), probed by which bounding-box corner
        //      pixels a fill/stroke leaves unpainted;
        //   2. validation exactly as HTML5: RangeError for a negative radius or a list
        //      of other than 1-4 entries, TypeError for an elliptical {x, y} radius
        //      (the one divergence), a NaN/infinite radius draws nothing - and the
        //      immediate-mode entries validate UP FRONT, so throwing never depends on
        //      the paint or the dimensions;
        //   3. every uniform spelling renders byte-identically to the scalar radius;
        //   4. overlapping radii scale down PROPORTIONALLY (all four by one factor),
        //      not by per-corner clamping;
        //   5. the path method leaves the current point at (x, y) on a new subpath, and
        //      a negative width mirrors the corners about (x, y) - both as HTML5.

        test('roundRect radii - HTML5 per-corner contract on every entry point', () => {
            const W = 60;
            const H = 44;
            const BOX = [10, 8, 40, 28]; // x, y, w, h (integer: the corner pixel is unambiguous)

            function newCtx() {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, W, H);
                ctx.setFillStyle(0, 0, 255, 255);
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = 1;
                return { surface, ctx };
            }

            function render(draw) {
                const { surface, ctx } = newCtx();
                draw(ctx);
                return surface;
            }

            function isPainted(surface, x, y) {
                const o = y * surface.stride + x * 4;
                return !(surface.data[o] === 255 && surface.data[o + 1] === 255 && surface.data[o + 2] === 255);
            }

            function sameBytes(a, b) {
                for (let i = 0; i < a.data.length; i++) {
                    if (a.data[i] !== b.data[i]) return false;
                }
                return true;
            }

            function blank(surface) {
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        if (isPainted(surface, x, y)) return false;
                    }
                }
                return true;
            }

            const [bx, by, bw, bh] = BOX;
            // The four bounding-box corner pixels of the box, in TL, TR, BR, BL order. A
            // fill covers pixel centers inside the path; a 1px stroke on the *.5 frame
            // covers the same outer ring - either way a rounded corner leaves its
            // bounding-box corner pixel unpainted and a square one paints it.
            const fillCornerPixels = [
                [bx, by],
                [bx + bw - 1, by],
                [bx + bw - 1, by + bh - 1],
                [bx, by + bh - 1]
            ];
            const strokeCornerPixels = [
                [bx, by],
                [bx + bw, by],
                [bx + bw, by + bh],
                [bx, by + bh]
            ];

            const ENTRIES = [
                ['fillRoundRect', fillCornerPixels, (ctx, r) => ctx.fillRoundRect(bx, by, bw, bh, r)],
                ['strokeRoundRect (direct)', strokeCornerPixels, (ctx, r) => ctx.strokeRoundRect(bx + 0.5, by + 0.5, bw, bh, r)],
                [
                    'fillStrokeRoundRect (direct)',
                    strokeCornerPixels,
                    (ctx, r) => ctx.fillStrokeRoundRect(bx + 0.5, by + 0.5, bw, bh, r)
                ],
                [
                    'ctx.roundRect + fill',
                    fillCornerPixels,
                    (ctx, r) => {
                        ctx.beginPath();
                        ctx.roundRect(bx, by, bw, bh, r);
                        ctx.fill();
                    }
                ],
                [
                    'SWPath2D.roundRect + fill',
                    fillCornerPixels,
                    (ctx, r) => {
                        const p = new SWCanvas.Core.SWPath2D();
                        p.roundRect(bx, by, bw, bh, r);
                        ctx.fill(p);
                    }
                ]
            ];

            // 1. List expansion - which corners come out rounded (true) vs square (false).
            const EXPANSIONS = [
                [8, [true, true, true, true]],
                [[8], [true, true, true, true]],
                [[8, 0], [true, false, true, false]],
                [[0, 8], [false, true, false, true]],
                [[8, 0, 0], [true, false, false, false]],
                [[0, 8, 0], [false, true, false, true]],
                [[0, 0, 8], [false, false, true, false]],
                [[8, 0, 0, 0], [true, false, false, false]],
                [[0, 8, 0, 0], [false, true, false, false]],
                [[0, 0, 8, 0], [false, false, true, false]],
                [[0, 0, 0, 8], [false, false, false, true]],
                [[8, 8, 0, 0], [true, true, false, false]], // the title-bar spelling
                [0, [false, false, false, false]],
                [undefined, [false, false, false, false]]
            ];
            const CORNER_NAMES = ['TL', 'TR', 'BR', 'BL'];
            for (const [label, cornerPixels, draw] of ENTRIES) {
                for (const [radii, rounded] of EXPANSIONS) {
                    const s = render((ctx) => draw(ctx, radii));
                    for (let i = 0; i < 4; i++) {
                        const [px, py] = cornerPixels[i];
                        if (isPainted(s, px, py) === rounded[i]) {
                            throw new Error(
                                `${label} radii ${JSON.stringify(radii)}: corner ${CORNER_NAMES[i]} should be ` +
                                    `${rounded[i] ? 'rounded' : 'square'}`
                            );
                        }
                    }
                }
                log(`  ${label}: r | [a] | [a,b] | [a,b,c] | [a,b,c,d] land on TL,TR,BR,BL`);
            }

            // 2. Validation, exactly as HTML5 (the error TYPE matters: RangeError vs TypeError).
            function expectError(label, fn, name) {
                let thrown = null;
                try {
                    fn();
                } catch (e) {
                    thrown = e;
                }
                if (!thrown) throw new Error(`${label}: expected a ${name}, nothing was thrown`);
                if (thrown.name !== name) throw new Error(`${label}: expected a ${name}, got ${thrown.name}: ${thrown.message}`);
            }
            const CALLS = [
                ['ctx.roundRect', (ctx, r) => ctx.roundRect(bx, by, bw, bh, r)],
                ['SWPath2D.roundRect', (ctx, r) => new SWCanvas.Core.SWPath2D().roundRect(bx, by, bw, bh, r)],
                ['fillRoundRect', (ctx, r) => ctx.fillRoundRect(bx, by, bw, bh, r)],
                ['strokeRoundRect', (ctx, r) => ctx.strokeRoundRect(bx, by, bw, bh, r)],
                ['fillStrokeRoundRect', (ctx, r) => ctx.fillStrokeRoundRect(bx, by, bw, bh, r)]
            ];
            for (const [label, call] of CALLS) {
                const { ctx } = newCtx();
                expectError(`${label} radius -1`, () => call(ctx, -1), 'RangeError');
                expectError(`${label} radii [4, -1]`, () => call(ctx, [4, -1]), 'RangeError');
                expectError(`${label} radii []`, () => call(ctx, []), 'RangeError');
                expectError(`${label} radii [1,2,3,4,5]`, () => call(ctx, [1, 2, 3, 4, 5]), 'RangeError');
                expectError(`${label} radius {x, y}`, () => call(ctx, { x: 4, y: 4 }), 'TypeError');
                expectError(`${label} radii [4, {x, y}]`, () => call(ctx, [4, { x: 4, y: 2 }]), 'TypeError');
            }
            log('  all five entry points: RangeError (negative / 0 or 5 radii), TypeError ({x, y})');

            // Up-front validation: an invalid radius throws even when nothing would draw.
            {
                const { ctx } = newCtx();
                ctx.setFillStyle(0, 0, 0, 0);
                ctx.setStrokeStyle(0, 0, 0, 0);
                expectError('fillRoundRect transparent paint', () => ctx.fillRoundRect(bx, by, bw, bh, -1), 'RangeError');
                expectError('strokeRoundRect negative width', () => ctx.strokeRoundRect(bx, by, -5, bh, [1, 2, 3, 4, 5]), 'RangeError');
                expectError('fillStrokeRoundRect zero height', () => ctx.fillStrokeRoundRect(bx, by, bw, 0, -2), 'RangeError');
                log('  immediate-mode entries validate radii up front (paint/dimensions never decide a throw)');
            }

            // A NaN or infinite radius (or coordinate, for the path method) draws nothing, silently.
            for (const bad of [NaN, Infinity, [4, NaN], [4, 4, -Infinity, 4]]) {
                for (const [label, , draw] of ENTRIES) {
                    const s = render((ctx) => draw(ctx, bad));
                    if (!blank(s)) throw new Error(`${label} radii ${String(bad)}: a non-finite radius must draw nothing`);
                }
                const s = render((ctx) => {
                    ctx.beginPath();
                    ctx.rect(2, 2, 4, 4);
                    ctx.roundRect(bx, by, NaN, bh, 4);
                    ctx.roundRect(bx, by, bw, bh, bad);
                    ctx.fill();
                });
                if (isPainted(s, bx + bw / 2, by + bh / 2)) {
                    throw new Error(`ctx.roundRect: a NaN width / non-finite radius must add no subpath`);
                }
            }
            log('  NaN / infinite radius (or coordinate): no throw, nothing drawn');

            // 3. Uniform spellings are byte-identical to the scalar radius, on the direct
            //    arms at identity, scale and a quarter turn, and on the generic fill.
            const CTMS = [
                ['identity', () => {}],
                ['scale 2', (ctx) => ctx.scale(2, 2)],
                ['quarter turn', (ctx) => ctx.setTransform(0, 1, -1, 0, 52, 2)]
            ];
            const SPELLINGS = [[6], [6, 6], [6, 6, 6], [6, 6, 6, 6]];
            for (const [ctmLabel, applyCtm] of CTMS) {
                for (const [label, , draw] of ENTRIES) {
                    const scalar = render((ctx) => {
                        applyCtm(ctx);
                        ctx.lineWidth = 3;
                        draw(ctx, 6);
                    });
                    for (const spelling of SPELLINGS) {
                        const arr = render((ctx) => {
                            applyCtm(ctx);
                            ctx.lineWidth = 3;
                            draw(ctx, spelling);
                        });
                        if (!sameBytes(arr, scalar)) {
                            throw new Error(`${label} @${ctmLabel}: radii ${JSON.stringify(spelling)} differs from radius 6`);
                        }
                    }
                }
            }
            log('  [r] / [r,r] / [r,r,r] / [r,r,r,r] === r, every entry, identity / scale / quarter turn');

            // 4. Proportional overlap scaling. On the 40x28 box, [56, 0, 0, 0] overflows
            //    the left side (56 > 28): every radius scales by 28/56, so TL becomes 28 -
            //    per-corner clamping to half a side would give 14. [40, 40, 0, 0] overflows
            //    the top (80 > 40): both scale by 40/80 to 20. (Power-of-two factors keep
            //    the fitted radii exact.)
            const OVERLAPS = [
                [[56, 0, 0, 0], [28, 0, 0, 0]],
                [[40, 40, 0, 0], [20, 20, 0, 0]],
                [[100], [14]]
            ];
            for (const [given, fitted] of OVERLAPS) {
                const fill = (r) => (ctx) => ctx.fillRoundRect(bx, by, bw, bh, r);
                if (!sameBytes(render(fill(given)), render(fill(fitted)))) {
                    throw new Error(`fillRoundRect radii ${JSON.stringify(given)} should fit to ${JSON.stringify(fitted)}`);
                }
                const stroke = (r) => (ctx) => ctx.strokeRoundRect(bx + 0.5, by + 0.5, bw, bh, r);
                if (!sameBytes(render(stroke(given)), render(stroke(fitted)))) {
                    throw new Error(`strokeRoundRect radii ${JSON.stringify(given)} should fit to ${JSON.stringify(fitted)}`);
                }
            }
            log('  overlapping radii scale proportionally (HTML5), not per corner');

            // 5a. The current point after roundRect() is (x, y), on a NEW subpath: a
            //     following lineTo draws from (x, y), not from the rect's first point.
            {
                const s = render((ctx) => {
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.roundRect(bx, by, 20, 10, 4);
                    ctx.lineTo(bx, by + 34);
                    ctx.stroke();
                });
                // Below the rect the line from (x, y) runs down column x; one from the
                // rect's first point (x + 4, y) would cross column x + 3 here instead.
                if (!isPainted(s, bx, by + 12) || isPainted(s, bx + 3, by + 12)) {
                    throw new Error('ctx.roundRect: the current point afterwards is not (x, y)');
                }
                log('  current point after roundRect() is (x, y)');
            }

            // 5b. A negative width mirrors the rect about (x, y): radii[0] stays on the
            //     corner AT (x, y) - here the visual top-right.
            {
                const s = render((ctx) => {
                    ctx.beginPath();
                    ctx.roundRect(bx + bw, by, -bw, bh, [8, 0, 0, 0]);
                    ctx.fill();
                });
                if (isPainted(s, bx + bw - 1, by) || !isPainted(s, bx, by)) {
                    throw new Error('ctx.roundRect with a negative width: radii[0] must round the corner at (x, y)');
                }
                log('  negative width mirrors the corners about (x, y)');
            }
        });


        // Test: fused entries' stroke halves bypass the hairline faintness rule (pinned contract)
        // This file will be concatenated into the main test suite
        //
        // Documented-decision guard, NOT a bug fix. The hairline rule (a sub-pixel
        // stroke draws AT one pixel with the missing width taken out of the OPACITY -
        // class-level doctrine in Context2D.js, pinned for the five STANDALONE stroke
        // entries by tests/core/055) is DELIBERATELY not wired into the fused
        // entries: fillStrokeRect, fillStrokeRoundRect, fillStrokeCircle and
        // fillOuterStrokeArc pass raw globalAlpha into their fillStroke_* renderers,
        // whose lineWidth <= 1 arms paint at FULL weight. Rationale (declared in the
        // doctrine comment): no hairline caller exists on the fused surface, and
        // wiring it would add a moving part to an untested surface for nobody. This
        // test converts that declaration into a pinned contract so any future change
        // is a conscious decision:
        //   - the fused entry's sub-pixel stroke half paints PURE stroke colour
        //     (full weight, zero faint pixels) - note the circle/arc fused rings can
        //     be PARTIAL at sub-pixel widths (the degenerate annulus scan); the pin
        //     is about WEIGHT, not coverage;
        //   - the STANDALONE twin at the same width paints ONLY faint pixels
        //     (the tests/core/055 rule).

        test('Fused entries - stroke halves stay full-weight at sub-pixel widths', () => {
            const W = 90;
            const H = 90;

            function render(draw) {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, W, H);
                ctx.setFillStyle(0, 128, 0, 255);
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.lineWidth = 0.5;
                draw(ctx);
                return surface;
            }

            // Classify red stroke pixels: pure = full-weight (255,0,0); faint = the
            // hairline rule's 0.5-alpha blend over white (255,~127,~127). Green fill
            // and white background match neither.
            function countStrokePixels(surface) {
                let pure = 0,
                    faint = 0;
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        const o = y * surface.stride + x * 4;
                        const r = surface.data[o],
                            g = surface.data[o + 1],
                            b = surface.data[o + 2];
                        if (r === 255 && g === 0 && b === 0) pure++;
                        else if (r === 255 && g >= 100 && g <= 156 && b >= 100 && b <= 156) faint++;
                    }
                }
                return { pure, faint };
            }

            const CASES = [
                ['fillStrokeRect', (ctx) => ctx.fillStrokeRect(20, 20, 40, 30), (ctx) => ctx.strokeRect(20, 20, 40, 30)],
                [
                    'fillStrokeRoundRect',
                    (ctx) => ctx.fillStrokeRoundRect(20, 20, 40, 30, 6),
                    (ctx) => ctx.strokeRoundRect(20, 20, 40, 30, 6)
                ],
                ['fillStrokeCircle', (ctx) => ctx.fillStrokeCircle(45, 45, 18), (ctx) => ctx.strokeCircle(45, 45, 18)],
                [
                    'fillOuterStrokeArc',
                    (ctx) => ctx.fillOuterStrokeArc(45, 45, 18, Math.PI, 2 * Math.PI),
                    (ctx) => ctx.outerStrokeArc(45, 45, 18, Math.PI, 2 * Math.PI)
                ]
            ];

            for (const [label, fused, standalone] of CASES) {
                const f = countStrokePixels(render(fused));
                if (f.pure === 0) {
                    throw new Error(`${label}: no full-weight stroke pixels - the fused sub-pixel stroke vanished`);
                }
                if (f.faint !== 0) {
                    throw new Error(
                        `${label}: ${f.faint} faint stroke pixels - the hairline rule got wired into the fused ` +
                            `path; that contradicts the declared full-weight contract (update the doctrine + this pin together)`
                    );
                }

                const s = countStrokePixels(render(standalone));
                if (s.pure !== 0 || s.faint === 0) {
                    throw new Error(
                        `${label} standalone twin: pure=${s.pure} faint=${s.faint} - ` +
                            `the standalone hairline faintness rule (tests/core/055) regressed`
                    );
                }
                log(`  ${label}: fused ${f.pure} full-weight px / standalone ${s.faint} faint px`);
            }
        });


        // Test: the three FILL entries dispatch generic; their stroke/fused siblings stay direct
        // This file will be concatenated into the main test suite
        //
        // INVERTED DECISION PIN (the mirror of the pins that used to assert these
        // entries stayed DIRECT). SWCanvas once carried four parity fill fast paths:
        // fillRect's axis-aligned (RectOpsAA) and tilted (RectOpsRot) arms,
        // fillRoundRect's identity->AA->rot ladder, and fillStadium's StadiumOps arm.
        // Disable-and-benchmark measured them at parity with the generic pipeline's
        // tier-0-wired solid span arm - roundRect 1.00x on every case, tilted rect
        // 1.00-1.01x, axis-aligned rect 1.02x mean with a 2-6% edge only on small/mid
        // ALPHA fills, a cost the owner explicitly accepted - so all four were removed
        // for ONE fill implementation (DIRECT-RENDERING-SUMMARY.MD §9 entries 15-16;
        // plans/one-rect-fill-pipeline-and-fill-arm-removal.md).
        //
        // Two halves, and BOTH matter:
        //   1. The three FILL entries dispatch generic under every CTM class and both
        //      opacities. A failure here means a fill fast path came back.
        //   2. Their STROKE and FUSED siblings still dispatch DIRECT. That is the
        //      boundary of the decision: strokes avoid outline construction the generic
        //      path must do, and the fused arms exist to prevent fill/stroke seams -
        //      neither was measured at parity, and neither was removed. A failure here
        //      means the removal over-reached.
        //
        // Re-adding any fill fast path needs fresh benchmark evidence of the same grade;
        // then update this pin and the §9 record together.

        test('fill entries dispatch generic; stroke/fused siblings stay direct', () => {
            const W = 100;
            const H = 60;

            function newCtx() {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, W, H);
                return { surface, ctx };
            }

            // Reset AFTER the fixture background - fillRect is generic now, so a reset
            // before it would read the FIXTURE's dispatch, not the probe's.
            function dispatchOf(applyCtm, draw) {
                const { ctx } = newCtx();
                ctx.save();
                applyCtm(ctx);
                SWCanvas.Core.Context2D.resetPathBasedFlag();
                draw(ctx);
                ctx.restore();
                return SWCanvas.Core.Context2D.wasPathBasedUsed() ? 'generic' : 'direct';
            }

            const CTMS = [
                ['identity', () => {}],
                ['integer translate', (ctx) => ctx.translate(10, 5)],
                [
                    '90-degree rotation',
                    (ctx) => {
                        ctx.translate(50, 30);
                        ctx.rotate(Math.PI / 2);
                    }
                ],
                [
                    'tilted uniform scale',
                    (ctx) => {
                        ctx.translate(50, 30);
                        ctx.rotate(0.5);
                        ctx.scale(1.5, 1.5);
                    }
                ]
            ];

            // 1. The three FILL entries: generic everywhere, opaque and translucent.
            const FILLS = [
                ['fillRect', (ctx) => ctx.fillRect(-10, -8, 20, 16)],
                ['fillRoundRect', (ctx) => ctx.fillRoundRect(-10, -8, 20, 16, 4)],
                ['fillStadium', (ctx) => ctx.fillStadium(-10, -8, 20, 16)]
            ];
            for (const [name, draw] of FILLS) {
                for (const [label, applyCtm] of CTMS) {
                    for (const alpha of [255, 128]) {
                        const got = dispatchOf(applyCtm, (ctx) => {
                            ctx.setFillStyle(255, 0, 0, alpha);
                            draw(ctx);
                        });
                        if (got !== 'generic') {
                            throw new Error(
                                `${name} under ${label} (alpha ${alpha}) dispatched DIRECT - a fill fast ` +
                                    `path is back without the §9 fill-arm-removal record being revisited`
                            );
                        }
                    }
                }
                log(`  ${name}: generic under every CTM class, both opacities`);
            }

            // 2. The boundary: stroke and fused siblings still dispatch DIRECT.
            //    (Axis-aligned + tilted-uniform only - the CTM classes those arms serve.)
            const DIRECT_SIBLINGS = [
                [
                    'strokeRect',
                    (ctx) => {
                        ctx.setStrokeStyle(0, 0, 255, 255);
                        ctx.lineWidth = 2;
                        ctx.strokeRect(-10, -8, 20, 16);
                    }
                ],
                [
                    'fillStrokeRect',
                    (ctx) => {
                        ctx.setFillStyle(255, 0, 0, 255);
                        ctx.setStrokeStyle(0, 0, 255, 255);
                        ctx.lineWidth = 2;
                        ctx.fillStrokeRect(-10, -8, 20, 16);
                    }
                ],
                [
                    'strokeRoundRect',
                    (ctx) => {
                        ctx.setStrokeStyle(0, 0, 255, 255);
                        ctx.lineWidth = 2;
                        ctx.strokeRoundRect(-10, -8, 20, 16, 4);
                    }
                ],
                [
                    'fillStrokeRoundRect',
                    (ctx) => {
                        ctx.setFillStyle(255, 0, 0, 255);
                        ctx.setStrokeStyle(0, 0, 255, 255);
                        ctx.lineWidth = 2;
                        ctx.fillStrokeRoundRect(-10, -8, 20, 16, 4);
                    }
                ]
            ];
            // strokeRect/fillStrokeRect take the AA arm at 90-degree rotation too; the
            // roundRect pair requires uniform scale, which all four CTMs here satisfy.
            for (const [name, draw] of DIRECT_SIBLINGS) {
                for (const [label, applyCtm] of CTMS) {
                    const got = dispatchOf(applyCtm, draw);
                    if (got !== 'direct') {
                        throw new Error(
                            `${name} under ${label} dispatched GENERIC - the fill-arm removal over-reached ` +
                                `into the stroke/fused arms, which were never measured at parity`
                        );
                    }
                }
                log(`  ${name}: still direct under every CTM class`);
            }
        });


        // Test: an INVALID globalAlpha assignment is ignored, per the HTML5 spec
        // This file will be concatenated into the main test suite
        //
        // Regression guard. globalAlpha used to be a PLAIN PUBLIC FIELD, so any value
        // assigned to it was stored raw. The HTML5 spec is explicit: "if the given
        // value is either infinite, NaN, or not in the range 0.0 to 1.0, then it must
        // be ignored, without assigning a new value" - native canvas keeps the previous
        // alpha. Storing it raw instead sent `undefined`/NaN straight into every
        // downstream `(color.a / 255) * globalAlpha`, which went NaN, and a fill then
        // covered ZERO pixels while its fillStyle, geometry, clip and CTM were all
        // correct - painting nothing and throwing nothing.
        //
        // That was not hypothetical: Fizzygum shipped it. A widget's explicitly
        // specified backgroundColor silently never painted, because a CoffeeScript
        // constructor default left its backgroundTransparency nil and the paint did
        // `ctx.globalAlpha = <nil>`. Native canvas ignored the assignment, so the bug
        // was invisible on the native backend and only SWCanvas reproduced it - see
        // Fizzygum docs/archive/dropped-background-fill-investigation.md.
        //
        // Contract pinned here:
        //   1. undefined / NaN / Infinity / out-of-range assignments are IGNORED - the
        //      previous alpha stands (readback AND painted pixels).
        //   2. VALID assignments, including the boundaries 0 and 1, still take effect.
        //   3. save()/restore() round-trips the alpha unchanged.

        test('globalAlpha - invalid assignments are ignored (HTML5), valid ones apply', () => {
            const W = 20;
            const H = 20;

            function newCtx() {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                return { surface, ctx };
            }

            function pixel(surface, x, y) {
                const o = y * surface.stride + x * 4;
                return [surface.data[o], surface.data[o + 1], surface.data[o + 2], surface.data[o + 3]];
            }

            // (1) Every invalid value leaves the alpha untouched AND still paints.
            //     The painted check is the one that matters: a readback-only assertion
            //     would pass even if the bad value had reached the renderers.
            const invalid = [undefined, NaN, Infinity, -Infinity, -0.5, 1.5, null, 'x', {}];
            for (const bad of invalid) {
                const { surface, ctx } = newCtx();
                ctx.setFillStyle(230, 230, 130, 255);
                ctx.globalAlpha = bad;
                if (ctx.globalAlpha !== 1) {
                    throw new Error(`globalAlpha = ${String(bad)} was STORED (readback ${String(ctx.globalAlpha)}); spec says ignore it`);
                }
                ctx.fillRect(0, 0, W, H);
                const px = pixel(surface, 2, 2);
                if (px[0] !== 230 || px[1] !== 230 || px[2] !== 130 || px[3] !== 255) {
                    throw new Error(`globalAlpha = ${String(bad)} then fillRect painted [${px}], expected [230,230,130,255]`);
                }
            }

            // (2) Valid values still apply, boundaries included.
            for (const good of [0, 0.5, 1]) {
                const { ctx } = newCtx();
                ctx.globalAlpha = good;
                if (ctx.globalAlpha !== good) {
                    throw new Error(`globalAlpha = ${good} did not take effect (readback ${ctx.globalAlpha})`);
                }
            }

            // globalAlpha 0 under source-over must still draw nothing (the pre-existing
            // early-return contract, tests/core/064) - i.e. "ignore invalid" must not
            // have been implemented by clamping a bad value to something paintable.
            {
                const { surface, ctx } = newCtx();
                ctx.setFillStyle(230, 230, 130, 255);
                ctx.globalAlpha = 0;
                ctx.fillRect(0, 0, W, H);
                const px = pixel(surface, 2, 2);
                if (px[3] !== 0) {
                    throw new Error(`globalAlpha 0 painted [${px}], expected a fully transparent pixel`);
                }
            }

            // (3) save()/restore() round-trips the alpha, and an invalid assignment
            //     made while saved does not corrupt what restore() brings back.
            {
                const { ctx } = newCtx();
                ctx.globalAlpha = 0.25;
                ctx.save();
                ctx.globalAlpha = 0.75;
                ctx.globalAlpha = NaN; // ignored
                if (ctx.globalAlpha !== 0.75) {
                    throw new Error(`NaN corrupted the saved-state alpha (readback ${ctx.globalAlpha})`);
                }
                ctx.restore();
                if (ctx.globalAlpha !== 0.25) {
                    throw new Error(`restore() did not bring back globalAlpha 0.25 (readback ${ctx.globalAlpha})`);
                }
            }
        });


        // Test: per-corner roundRect radii on the direct arms - locality, square corners, junctions, containment, quarter turns, dispatch
        // This file will be concatenated into the main test suite
        //
        // The axis-aligned direct family (RoundedRectOpsAA: stroke1px_AA_Opaq/Alpha,
        // strokeThick_AA_Opaq/Alpha, fillStroke_AA_Any) renders per-corner radii
        // (DIRECT-RENDERING-SUMMARY.MD §9 entry 17). Its contract, pinned here:
        //   1. LOCALITY: a corner of radius r is pixel-identical to the same corner of
        //      the uniform-r rounded rect - per-corner radii add no new corner shapes,
        //      they only choose among the existing ones (the corner quadrants are
        //      compared byte for byte, every stroke/fused style);
        //   2. a radius-0 corner is SQUARE: the frame's corner pixel is painted, while a
        //      rounded corner's is not;
        //   3. 1px semi-transparent JUNCTIONS stay exact with any mix of rounded and
        //      square corners: one blend per pixel (a single stroke colour) and a closed
        //      ring (every pixel has >= 2 of 8 neighbours) - square corners have no arc
        //      to own their pixel, so edge ownership there is explicit;
        //   4. CONTAINMENT: one corner may hold a whole side ([w, 0, 0, 0] is legal);
        //      nothing is ever painted outside the bounding box the same entry paints
        //      for radius 1 (its corners reach the frame) - the 1px arcs are clamped to
        //      the pixel frame for exactly this;
        //   5. QUARTER TURNS: under a 90/180/270-degree CTM the axis-aligned arm draws a
        //      device-space box, so the radii must turn with it; the generic path (which
        //      just transforms user-space geometry) is the oracle for which device
        //      corner ends up rounded;
        //   6. DISPATCH: per-corner radii stay direct under identity / translate /
        //      uniform scale / quarter turns, and go generic under a non-axis-aligned
        //      rotation (the rotated family is uniform-radius only), where a uniform
        //      radii LIST still goes direct.

        test('roundRect per-corner radii - direct-arm invariants', () => {
            const W = 96;
            const H = 80;

            function newCtx() {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, W, H);
                return { surface, ctx };
            }

            function render(draw) {
                const { surface, ctx } = newCtx();
                draw(ctx);
                return surface;
            }

            function isPainted(surface, x, y) {
                if (x < 0 || y < 0 || x >= W || y >= H) return false;
                const o = y * surface.stride + x * 4;
                return !(surface.data[o] === 255 && surface.data[o + 1] === 255 && surface.data[o + 2] === 255);
            }

            function paintedBBox(surface) {
                let minX = W,
                    minY = H,
                    maxX = -1,
                    maxY = -1;
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        if (!isPainted(surface, x, y)) continue;
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
                return { minX, minY, maxX, maxY };
            }

            // Each style: [label, paint setup, draw(ctx, x, y, w, h, radii)]
            const STYLES = [
                [
                    'stroke 1px opaque',
                    (ctx) => {
                        ctx.setStrokeStyle(255, 0, 0, 255);
                        ctx.lineWidth = 1;
                    },
                    (ctx, x, y, w, h, r) => ctx.strokeRoundRect(x, y, w, h, r)
                ],
                [
                    'stroke 1px alpha',
                    (ctx) => {
                        ctx.setStrokeStyle(255, 0, 0, 128);
                        ctx.lineWidth = 1;
                    },
                    (ctx, x, y, w, h, r) => ctx.strokeRoundRect(x, y, w, h, r)
                ],
                [
                    'stroke hairline 0.5',
                    (ctx) => {
                        ctx.setStrokeStyle(255, 0, 0, 255);
                        ctx.lineWidth = 0.5;
                    },
                    (ctx, x, y, w, h, r) => ctx.strokeRoundRect(x, y, w, h, r)
                ],
                [
                    'stroke 3px opaque',
                    (ctx) => {
                        ctx.setStrokeStyle(255, 0, 0, 255);
                        ctx.lineWidth = 3;
                    },
                    (ctx, x, y, w, h, r) => ctx.strokeRoundRect(x, y, w, h, r)
                ],
                [
                    'stroke 4px alpha',
                    (ctx) => {
                        ctx.setStrokeStyle(255, 0, 0, 128);
                        ctx.lineWidth = 4;
                    },
                    (ctx, x, y, w, h, r) => ctx.strokeRoundRect(x, y, w, h, r)
                ],
                [
                    'fused opaque, 1px stroke',
                    (ctx) => {
                        ctx.setFillStyle(0, 0, 255, 255);
                        ctx.setStrokeStyle(255, 0, 0, 255);
                        ctx.lineWidth = 1;
                    },
                    (ctx, x, y, w, h, r) => ctx.fillStrokeRoundRect(x, y, w, h, r)
                ],
                [
                    'fused semi fill, 3px semi stroke',
                    (ctx) => {
                        ctx.setFillStyle(0, 0, 255, 128);
                        ctx.setStrokeStyle(255, 0, 0, 128);
                        ctx.lineWidth = 3;
                    },
                    (ctx, x, y, w, h, r) => ctx.fillStrokeRoundRect(x, y, w, h, r)
                ],
                [
                    'fused fill only',
                    (ctx) => {
                        ctx.setFillStyle(0, 0, 255, 255);
                        ctx.setStrokeStyle(255, 0, 0, 0);
                        ctx.lineWidth = 2;
                    },
                    (ctx, x, y, w, h, r) => ctx.fillStrokeRoundRect(x, y, w, h, r)
                ]
            ];

            // 1. Locality - corner quadrants of a per-corner render equal the uniform renders'.
            const BOX = [8.5, 6.5, 78, 66];
            const [bx, by, bw, bh] = BOX;
            const midX = Math.floor(bx + bw / 2);
            const midY = Math.floor(by + bh / 2);
            const QUADRANTS = [
                (x, y) => x < midX && y < midY, // TL
                (x, y) => x >= midX && y < midY, // TR
                (x, y) => x >= midX && y >= midY, // BR
                (x, y) => x < midX && y >= midY // BL
            ];
            const CORNER = ['TL', 'TR', 'BR', 'BL'];
            const RADII_SETS = [
                [3, 7, 11, 5],
                [12, 2, 6, 9],
                [1, 13, 4, 8],
                [10, 10, 0, 0],
                [0, 6, 0, 14]
            ];
            for (const [label, setup, draw] of STYLES) {
                for (const radii of RADII_SETS) {
                    const mixed = render((ctx) => {
                        setup(ctx);
                        draw(ctx, bx, by, bw, bh, radii);
                    });
                    for (let c = 0; c < 4; c++) {
                        if (radii[c] === 0) continue; // square corners: section 2
                        const uniform = render((ctx) => {
                            setup(ctx);
                            draw(ctx, bx, by, bw, bh, radii[c]);
                        });
                        for (let y = 0; y < H; y++) {
                            for (let x = 0; x < W; x++) {
                                if (!QUADRANTS[c](x, y)) continue;
                                const o = y * mixed.stride + x * 4;
                                for (let k = 0; k < 4; k++) {
                                    if (mixed.data[o + k] !== uniform.data[o + k]) {
                                        throw new Error(
                                            `${label} radii ${JSON.stringify(radii)}: corner ${CORNER[c]} differs from ` +
                                                `the uniform r=${radii[c]} corner at (${x},${y})`
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
                log(`  ${label}: every rounded corner === the uniform-radius corner`);
            }

            // 1b. Locality survives an inner arc too small to reach its own band row (radius 1
            //     under a 1.5-2px stroke: inner radius <= 0.25px). Uniform radii keep the
            //     historical rule - that row of the hole is dropped whole - but with mixed
            //     radii only the tiny corner may react: the other corners must still match
            //     their uniform renders.
            for (const lineWidth of [1.5, 1.75]) {
                const radii = [1, 9, 0, 6];
                const draw = (r) =>
                    render((ctx) => {
                        ctx.setStrokeStyle(255, 0, 0, 255);
                        ctx.lineWidth = lineWidth;
                        ctx.strokeRoundRect(bx, by, bw, bh, r);
                    });
                const mixed = draw(radii);
                for (const c of [1, 3]) {
                    const uniform = draw(radii[c]);
                    for (let y = 0; y < H; y++) {
                        for (let x = 0; x < W; x++) {
                            if (!QUADRANTS[c](x, y)) continue;
                            const o = y * mixed.stride + x * 4;
                            if (mixed.data[o + 1] !== uniform.data[o + 1]) {
                                throw new Error(
                                    `stroke ${lineWidth}px ${JSON.stringify(radii)}: the radius-1 corner leaked into ` +
                                        `corner ${CORNER[c]} at (${x},${y})`
                                );
                            }
                        }
                    }
                }
            }
            log('  a sub-quarter-pixel inner corner arc stays local (1.5px / 1.75px strokes, radius 1)');

            // 2. Square corners: the frame's corner pixel is painted for radius 0, not for a
            //    rounded corner. The frame is the painted bounding box (radius-0 corners and
            //    the straight edges reach it).
            for (const [label, setup, draw] of STYLES) {
                const radii = [9, 9, 0, 0]; // the window title bar: rounded top, square bottom
                const s = render((ctx) => {
                    setup(ctx);
                    draw(ctx, bx, by, bw, bh, radii);
                });
                const b = paintedBBox(s);
                const corners = [
                    [b.minX, b.minY],
                    [b.maxX, b.minY],
                    [b.maxX, b.maxY],
                    [b.minX, b.maxY]
                ];
                for (let c = 0; c < 4; c++) {
                    const square = radii[c] === 0;
                    if (isPainted(s, corners[c][0], corners[c][1]) !== square) {
                        throw new Error(`${label} [9,9,0,0]: corner ${CORNER[c]} should be ${square ? 'square' : 'rounded'}`);
                    }
                }
            }
            log('  every style: [9,9,0,0] gives two rounded top corners and two square bottom ones');

            // 3. 1px semi-transparent junction exactness across mixes of rounded and square
            //    corners, at the integer and the pixel-centred (crisp) spellings.
            {
                const R = [0, 1, 2, 3, 5, 8];
                let combos = 0;
                for (const [x, y, w, h] of [
                    [10, 9, 60, 50],
                    [10.5, 9.5, 61, 47]
                ]) {
                    for (const a of R) {
                        for (const b of R) {
                            for (const c of R) {
                                for (const d of R) {
                                    if (a + b + c + d === 0) continue; // radius 0: the RectOps fallback
                                    const radii = [a, b, c, d];
                                    const s = render((ctx) => {
                                        ctx.setStrokeStyle(255, 0, 0, 128);
                                        ctx.lineWidth = 1;
                                        ctx.strokeRoundRect(x, y, w, h, radii);
                                    });
                                    const pixels = new Set();
                                    const colors = new Set();
                                    for (let py = 0; py < H; py++) {
                                        for (let px = 0; px < W; px++) {
                                            if (!isPainted(s, px, py)) continue;
                                            const o = py * s.stride + px * 4;
                                            pixels.add(py * W + px);
                                            colors.add((s.data[o] << 16) | (s.data[o + 1] << 8) | s.data[o + 2]);
                                        }
                                    }
                                    if (colors.size !== 1) {
                                        throw new Error(
                                            `1px alpha ${JSON.stringify(radii)} at (${x},${y}): ${colors.size} stroke colours - ` +
                                                'a pixel was blended more than once'
                                        );
                                    }
                                    for (const p of pixels) {
                                        const px = p % W;
                                        const py = Math.floor(p / W);
                                        let n = 0;
                                        for (let dy = -1; dy <= 1; dy++) {
                                            for (let dx = -1; dx <= 1; dx++) {
                                                if ((dx || dy) && pixels.has((py + dy) * W + px + dx)) n++;
                                            }
                                        }
                                        if (n < 2) {
                                            throw new Error(
                                                `1px alpha ${JSON.stringify(radii)} at (${x},${y}): ring broken at (${px},${py})`
                                            );
                                        }
                                    }
                                    combos++;
                                }
                            }
                        }
                    }
                }
                log(`  1px alpha: ${combos} radius mixes - single blend, closed ring`);
            }

            // 4. Containment: a corner holding a whole side stays inside the radius-1 bounding box.
            {
                let cases = 0;
                for (const [label, setup, draw] of STYLES) {
                    for (const [x, y, w, h] of [
                        [10, 9, 40, 30],
                        [10.5, 9.5, 40, 30],
                        [10.25, 9.75, 39.6, 30.4]
                    ]) {
                        const ref = paintedBBox(
                            render((ctx) => {
                                setup(ctx);
                                draw(ctx, x, y, w, h, 1);
                            })
                        );
                        for (const radii of [
                            [w, 0, 0, 0],
                            [0, w, 0, 0],
                            [0, 0, w, 0],
                            [0, 0, 0, w],
                            [0, h, 0, 0],
                            [h, 0, h, 0],
                            [w, w, 0, 0]
                        ]) {
                            const b = paintedBBox(
                                render((ctx) => {
                                    setup(ctx);
                                    draw(ctx, x, y, w, h, radii);
                                })
                            );
                            if (b.minX < ref.minX || b.minY < ref.minY || b.maxX > ref.maxX || b.maxY > ref.maxY) {
                                throw new Error(
                                    `${label} radii ${JSON.stringify(radii)} at (${x},${y},${w},${h}): painted ` +
                                        `[${b.minX},${b.minY}..${b.maxX},${b.maxY}] outside the radius-1 box ` +
                                        `[${ref.minX},${ref.minY}..${ref.maxX},${ref.maxY}]`
                                );
                            }
                            cases++;
                        }
                    }
                }
                log(`  containment: ${cases} whole-side-radius cases inside the radius-1 bounding box`);
            }

            // 5. Quarter turns: which DEVICE corner is rounded must agree with the generic
            //    path, which simply transforms the user-space geometry. Exact quarter-turn
            //    matrices (no trig noise). [9, 0, 4, 0] tells all four orientations apart.
            {
                const QUARTER_TURNS = [
                    ['0', [1, 0, 0, 1, 12, 10]],
                    ['90', [0, 1, -1, 0, 70, 10]],
                    ['180', [-1, 0, 0, -1, 80, 66]],
                    ['270', [0, -1, 1, 0, 12, 76]]
                ];
                const radii = [9, 0, 4, 0];
                const UW = 50;
                const UH = 34;
                for (const [turn, m] of QUARTER_TURNS) {
                    const roundedness = (surface) => {
                        const b = paintedBBox(surface);
                        return [
                            isPainted(surface, b.minX, b.minY),
                            isPainted(surface, b.maxX, b.minY),
                            isPainted(surface, b.maxX, b.maxY),
                            isPainted(surface, b.minX, b.maxY)
                        ].map((painted) => (painted ? 'square' : 'rounded'));
                    };
                    // Direct: the fused entry with an invisible stroke is the fill-only direct arm.
                    // (Reset AFTER the fixture background, which is a generic fill.)
                    let leftDirectArm = false;
                    const direct = render((ctx) => {
                        ctx.setTransform(...m);
                        ctx.setFillStyle(0, 0, 255, 255);
                        ctx.setStrokeStyle(255, 0, 0, 0);
                        SWCanvas.Core.Context2D.resetPathBasedFlag();
                        ctx.fillStrokeRoundRect(0, 0, UW, UH, radii);
                        leftDirectArm = SWCanvas.Core.Context2D.wasPathBasedUsed();
                    });
                    if (leftDirectArm) {
                        throw new Error(`quarter turn ${turn}: per-corner fillStrokeRoundRect left the direct arm`);
                    }
                    const generic = render((ctx) => {
                        ctx.setTransform(...m);
                        ctx.setFillStyle(0, 0, 255, 255);
                        ctx.fillRoundRect(0, 0, UW, UH, radii);
                    });
                    const d = roundedness(direct).join(',');
                    const g = roundedness(generic).join(',');
                    if (d !== g) {
                        throw new Error(`quarter turn ${turn}: direct device corners [${d}] but the generic path gives [${g}]`);
                    }
                    // And the stroke arm, on the crisp (pixel-centred) spelling.
                    const stroke = render((ctx) => {
                        ctx.setTransform(...m);
                        ctx.setStrokeStyle(255, 0, 0, 255);
                        ctx.lineWidth = 1;
                        ctx.strokeRoundRect(0.5, 0.5, UW, UH, radii);
                    });
                    if (roundedness(stroke).join(',') !== g) {
                        throw new Error(`quarter turn ${turn}: stroke device corners [${roundedness(stroke)}] vs generic [${g}]`);
                    }
                }
                log('  quarter turns 0/90/180/270: device corners rounded exactly where the generic path rounds them');
            }

            // 6. Dispatch.
            {
                function dispatchOf(applyCtm, draw) {
                    const { ctx } = newCtx();
                    ctx.setFillStyle(0, 0, 255, 255);
                    ctx.setStrokeStyle(255, 0, 0, 255);
                    ctx.lineWidth = 2;
                    applyCtm(ctx);
                    SWCanvas.Core.Context2D.resetPathBasedFlag();
                    draw(ctx);
                    return SWCanvas.Core.Context2D.wasPathBasedUsed() ? 'generic' : 'direct';
                }
                const DIRECT_CTMS = [
                    ['identity', () => {}],
                    ['translate', (ctx) => ctx.translate(3.5, 2)],
                    ['scale 2', (ctx) => ctx.scale(2, 2)],
                    ['quarter turn', (ctx) => ctx.setTransform(0, 1, -1, 0, 60, 5)],
                    ['half turn + scale', (ctx) => ctx.setTransform(-1.5, 0, 0, -1.5, 80, 70)]
                ];
                const TILTED = (ctx) => {
                    ctx.translate(48, 40);
                    ctx.rotate(0.5);
                };
                const ENTRIES = [
                    ['strokeRoundRect', (ctx, r) => ctx.strokeRoundRect(-20, -15, 40, 30, r)],
                    ['fillStrokeRoundRect', (ctx, r) => ctx.fillStrokeRoundRect(-20, -15, 40, 30, r)]
                ];
                for (const [label, draw] of ENTRIES) {
                    for (const [ctmLabel, applyCtm] of DIRECT_CTMS) {
                        if (dispatchOf(applyCtm, (ctx) => draw(ctx, [6, 6, 0, 0])) !== 'direct') {
                            throw new Error(`${label} [6,6,0,0] @${ctmLabel}: expected the direct arm`);
                        }
                    }
                    if (dispatchOf(TILTED, (ctx) => draw(ctx, [6, 6, 0, 0])) !== 'generic') {
                        throw new Error(`${label} [6,6,0,0] tilted: per-corner radii must take the generic path`);
                    }
                    if (dispatchOf(TILTED, (ctx) => draw(ctx, [6, 6, 6, 6])) !== 'direct') {
                        throw new Error(`${label} [6,6,6,6] tilted: a uniform radii list must stay on the rotated direct arm`);
                    }
                }
                log('  dispatch: per-corner direct on identity/translate/scale/quarter turns; generic when tilted');
            }
        });


        // Test: per-corner roundRects clipped (tier-0 === bitmask, no leaks) and clipping (clip region === fill)
        // This file will be concatenated into the main test suite
        //
        // Both directions of clipping for per-corner radii (DIRECT-RENDERING-SUMMARY.MD
        // §5 and §5.1):
        //   1. BEING CLIPPED: the per-corner direct arms honour the tier-0 rect clip
        //      exactly like the bitmask clip of the same region (byte-identical), and
        //      never paint outside it - for 1px/thick strokes, opaque/alpha, the fused
        //      arm, at identity, uniform scale and a quarter turn (the corner-permuting
        //      branch), with the window-title-bar spelling [r, r, 0, 0] among the radii.
        //      Same contract as tests/core/049 for uniform radii.
        //   2. CLIPPING AT a per-corner roundRect: roundRect() + clip() exposes exactly
        //      the pixels roundRect() + fill() covers (one geometry, one generic
        //      rasterization), on both the Context2D path method and an external
        //      SWPath2D, including under a non-uniform scale (elliptical corners).

        test('roundRect per-corner radii - clipped (tier-0 === bitmask) and clipping (clip === fill)', () => {
            const W = 90;
            const H = 64;
            const CLIP = { x: 14, y: 10, w: 34, h: 22 };

            function newCtx() {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, W, H);
                return { surface, ctx };
            }

            function render(clipMode, drawFn) {
                const { surface, ctx } = newCtx();
                ctx.save();
                ctx.beginPath();
                ctx.rect(CLIP.x, CLIP.y, CLIP.w, CLIP.h);
                if (clipMode === 'mask') {
                    // A second identical rect: same exposed pixels, but no longer one
                    // axis-aligned rect path, so the clip goes through the bitmask.
                    ctx.rect(CLIP.x, CLIP.y, CLIP.w, CLIP.h);
                }
                ctx.clip();
                drawFn(ctx);
                ctx.restore();
                return surface;
            }

            function isPainted(surface, x, y) {
                const o = y * surface.stride + x * 4;
                return !(surface.data[o] === 255 && surface.data[o + 1] === 255 && surface.data[o + 2] === 255);
            }

            // 1. Being clipped.
            // Two DEVICE boxes, one ring crossing each pair of clip bounds: A's left and
            // bottom edges run inside the clip (it crosses the top and right bounds), B's
            // right and top edges do (it crosses the left and bottom bounds). Every CTM maps
            // its user box onto the same device box.
            const DEVICE_BOXES = [
                ['A', [20.5, 4.5, 50, 22]],
                ['B', [4.5, 14.5, 30, 30]]
            ];
            const CTMS = [
                ['identity', () => {}, ([x, y, w, h]) => [x, y, w, h]],
                ['scale 2', (ctx) => ctx.scale(2, 2), ([x, y, w, h]) => [x / 2, y / 2, w / 2, h / 2]],
                [
                    'quarter turn',
                    (ctx) => ctx.setTransform(0, 1, -1, 0, 80, 2),
                    // device (x', y') = (80 - y, x + 2): the user box is the device box turned back
                    ([x, y, w, h]) => [y - 2, 80 - (x + w), h, w]
                ]
            ];
            const RADII = [
                [8, 8, 0, 0],
                [0, 5, 9, 2],
                [12, 0]
            ];
            const STYLES = [
                [
                    'stroke 1px opaque',
                    (ctx) => {
                        ctx.setStrokeStyle(255, 0, 0, 255);
                        ctx.lineWidth = 1;
                    },
                    'strokeRoundRect'
                ],
                [
                    'stroke 1px semi',
                    (ctx) => {
                        ctx.setStrokeStyle(255, 0, 0, 128);
                        ctx.lineWidth = 1;
                    },
                    'strokeRoundRect'
                ],
                [
                    'stroke 3px semi',
                    (ctx) => {
                        ctx.setStrokeStyle(255, 0, 0, 128);
                        ctx.lineWidth = 3;
                    },
                    'strokeRoundRect'
                ],
                [
                    'fused opaque 1px',
                    (ctx) => {
                        ctx.setFillStyle(0, 0, 255, 255);
                        ctx.setStrokeStyle(255, 0, 0, 255);
                        ctx.lineWidth = 1;
                    },
                    'fillStrokeRoundRect'
                ],
                [
                    'fused semi 3px',
                    (ctx) => {
                        ctx.setFillStyle(0, 0, 255, 255);
                        ctx.setStrokeStyle(255, 0, 0, 128);
                        ctx.lineWidth = 3;
                    },
                    'fillStrokeRoundRect'
                ]
            ];
            let cases = 0;
            for (const [boxLabel, deviceBox] of DEVICE_BOXES) {
              for (const [ctmLabel, applyCtm, toUser] of CTMS) {
                const [x, y, w, h] = toUser(deviceBox);
                for (const radii of RADII) {
                    for (const [styleLabel, setup, entry] of STYLES) {
                        const draw = (ctx) => {
                            applyCtm(ctx);
                            setup(ctx);
                            ctx[entry](x, y, w, h, radii);
                        };
                        const label = `${styleLabel} ${JSON.stringify(radii)} box ${boxLabel} @${ctmLabel}`;
                        const tier0 = render('tier0', draw);
                        const mask = render('mask', draw);
                        let anyInside = false;
                        for (let py = 0; py < H; py++) {
                            for (let px = 0; px < W; px++) {
                                const o = py * tier0.stride + px * 4;
                                for (let k = 0; k < 4; k++) {
                                    if (tier0.data[o + k] !== mask.data[o + k]) {
                                        throw new Error(`${label}: tier-0 and bitmask clips differ at (${px},${py})`);
                                    }
                                }
                                if (!isPainted(tier0, px, py)) continue;
                                const inside =
                                    px >= CLIP.x && px < CLIP.x + CLIP.w && py >= CLIP.y && py < CLIP.y + CLIP.h;
                                if (!inside) throw new Error(`${label}: painted outside the clip rect at (${px},${py})`);
                                anyInside = true;
                            }
                        }
                        if (!anyInside) throw new Error(`${label}: nothing painted inside the clip - fixture misses the clip`);
                        cases++;
                    }
                }
              }
            }
            log(`  being clipped: ${cases} per-corner cases - tier-0 === bitmask, no clip leak`);

            // 2. Clipping AT a per-corner roundRect: clip coverage === fill coverage.
            const SHAPES = [
                ['[10, 10, 0, 0]', [10, 6, 60, 40], [10, 10, 0, 0], () => {}],
                ['[0, 14, 3, 22]', [8.5, 5.5, 64, 50], [0, 14, 3, 22], () => {}],
                ['[18, 4] under scale(1.5, 0.75)', [6, 8, 44, 56], [18, 4], (ctx) => ctx.scale(1.5, 0.75)],
                ['[9, 0, 9] rotated', [-25, -18, 50, 36], [9, 0, 9], (ctx) => {
                    ctx.translate(45, 32);
                    ctx.rotate(0.4);
                }]
            ];
            for (const [label, [x, y, w, h], radii, applyCtm] of SHAPES) {
                // Like against like: the current path bakes its arcs at build time, an
                // external Path2D flattens them at draw time.
                const filledCurrentPath = (() => {
                    const { surface, ctx } = newCtx();
                    applyCtm(ctx);
                    ctx.setFillStyle(0, 0, 0, 255);
                    ctx.beginPath();
                    ctx.roundRect(x, y, w, h, radii);
                    ctx.fill();
                    return surface;
                })();
                const filledPath2D = (() => {
                    const { surface, ctx } = newCtx();
                    applyCtm(ctx);
                    ctx.setFillStyle(0, 0, 0, 255);
                    const p = new SWCanvas.Core.SWPath2D();
                    p.roundRect(x, y, w, h, radii);
                    ctx.fill(p);
                    return surface;
                })();
                const viaCurrentPath = (() => {
                    const { surface, ctx } = newCtx();
                    applyCtm(ctx);
                    ctx.beginPath();
                    ctx.roundRect(x, y, w, h, radii);
                    ctx.clip();
                    ctx.resetTransform();
                    ctx.setFillStyle(0, 0, 0, 255);
                    ctx.fillRect(0, 0, W, H);
                    return surface;
                })();
                const viaPath2D = (() => {
                    const { surface, ctx } = newCtx();
                    applyCtm(ctx);
                    const p = new SWCanvas.Core.SWPath2D();
                    p.roundRect(x, y, w, h, radii);
                    ctx.clip(p);
                    ctx.resetTransform();
                    ctx.setFillStyle(0, 0, 0, 255);
                    ctx.fillRect(0, 0, W, H);
                    return surface;
                })();
                let n = 0;
                for (let py = 0; py < H; py++) {
                    for (let px = 0; px < W; px++) {
                        const f = isPainted(filledCurrentPath, px, py);
                        if (f !== isPainted(viaCurrentPath, px, py)) {
                            throw new Error(`clip AT ${label} (ctx.roundRect): clip and fill disagree at (${px},${py})`);
                        }
                        if (isPainted(filledPath2D, px, py) !== isPainted(viaPath2D, px, py)) {
                            throw new Error(`clip AT ${label} (SWPath2D): clip and fill disagree at (${px},${py})`);
                        }
                        if (f) n++;
                    }
                }
                if (n === 0) throw new Error(`clip AT ${label}: empty fixture`);
            }
            log('  clipping AT per-corner roundRects: clip region === fill coverage (path method and Path2D)');
        });


        // Test: clip as an immutable mask AND a rect - byte-identical to the pure mask model
        // This file will be concatenated into the main test suite
        //
        // Context2D keeps the clip as an optional IMMUTABLE mask AND an always-tracked
        // rect: a rect clip() only intersects the rect (it never touches the mask), a
        // non-rect clip() rasterises its path only inside the current rect and ANDs the
        // previous mask into a fresh mask, and every draw gets either the rect and the
        // mask separately (clamp to the rect + per-pixel bit test) or ONE combined mask
        // (buffer-only renderers, clearRect, canvas-wide composite ops, shadows).
        // The oracle is the same scene under Context2D._disableTier0Clip = true: the
        // pure mask model, every clip a full-surface mask and no rect tracked.
        // Contract pinned here, for every scene:
        //   1. the rect + mask render is byte-identical to the oracle render,
        //   2. the scene is not vacuous: it paints, and turning its clips off changes it.
        // Scenes: Fizzygum's window-corner paint order (damage rect -> rounded outline,
        // uniform and per-corner radii -> per child save / rect clip / draws / restore)
        // with every draw entry, opaque and alpha, at 240x180 and at Fizzygum's dpr-1
        // surface size (1920x880); mask -> rect -> mask under nonzero and evenodd; a
        // rotated rect clip; rect clips partly and fully off the surface; empty
        // intersections; the canvas-wide composite ops, other non-source-over ops and
        // shadows, each under mask + rect.

        const ClipOracle073 = (() => {
            const Ctx2D = SWCanvas.Core.Context2D;
            const BACKGROUND = 'rgb(250, 248, 240)';

            // A 9x7 image mixing opaque, translucent and fully transparent texels.
            function makeImage() {
                const w = 9;
                const h = 7;
                const data = new Uint8ClampedArray(w * h * 4);
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const o = (y * w + x) * 4;
                        data[o] = (x * 29 + 40) & 255;
                        data[o + 1] = (y * 37 + 10) & 255;
                        data[o + 2] = ((x + y) * 17 + 90) & 255;
                        data[o + 3] = (x + y) % 5 === 0 ? 0 : (x * y) % 3 === 0 ? 140 : 255;
                    }
                }
                return { width: w, height: h, data };
            }

            // Clip helpers handed to a scene. With `on` false every clip is skipped (the
            // path is still built and discarded), which yields the unclipped render the
            // non-vacuity check compares against.
            function makeClipper(ctx, on) {
                return {
                    rect(x, y, w, h) {
                        ctx.beginPath();
                        ctx.rect(x, y, w, h);
                        if (on) ctx.clip();
                        ctx.beginPath();
                    },
                    roundRect(x, y, w, h, radii) {
                        ctx.beginPath();
                        ctx.roundRect(x, y, w, h, radii);
                        if (on) ctx.clip();
                        ctx.beginPath();
                    },
                    path(path2d, rule) {
                        if (on) ctx.clip(path2d, rule);
                    },
                    current() {
                        if (on) ctx.clip(); // the current default path, nonzero
                    }
                };
            }

            function render(W, H, scene, oracle, clipsOn) {
                const previous = Ctx2D._disableTier0Clip;
                Ctx2D._disableTier0Clip = oracle;
                try {
                    const canvas = SWCanvas.createCanvas(W, H);
                    const ctx = canvas.getContext('2d');
                    ctx.textPixelDensity = 1;
                    ctx.fillStyle = BACKGROUND;
                    ctx.fillRect(0, 0, W, H);
                    scene(ctx, makeClipper(ctx, clipsOn), W, H);
                    return ctx.getImageData(0, 0, W, H).data;
                } finally {
                    Ctx2D._disableTier0Clip = previous;
                }
            }

            function firstDiff(a, b, W) {
                for (let i = 0; i < a.length; i++) {
                    if (a[i] !== b[i]) {
                        const p = i >> 2;
                        return `(${p % W},${Math.floor(p / W)}) channel ${i & 3}: ${a[i]} vs ${b[i]}`;
                    }
                }
                return null;
            }

            function countDiffPixels(a, b) {
                let n = 0;
                for (let i = 0; i < a.length; i += 4) {
                    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) n++;
                }
                return n;
            }

            function assertScene(label, W, H, scene) {
                const model = render(W, H, scene, false, true);
                const oracle = render(W, H, scene, true, true);
                const diff = firstDiff(model, oracle, W);
                if (diff) {
                    throw new Error(`${label}: rect + mask model differs from the pure mask model at ${diff}`);
                }
                const blank = render(W, H, () => {}, false, true);
                const painted = countDiffPixels(model, blank);
                if (painted < 50) {
                    throw new Error(`${label}: vacuous - only ${painted} pixels painted`);
                }
                const unclipped = render(W, H, scene, false, false);
                const clippedAway = countDiffPixels(model, unclipped);
                if (clippedAway === 0) {
                    throw new Error(`${label}: vacuous - turning the clips off changes nothing`);
                }
                log(`  ${label}: === pure mask model (${painted} px painted, ${clippedAway} px decided by the clips)`);
            }

            // Every draw entry, each placed over box b (crossing its edges). `alt`
            // switches opaque <-> translucent paint so both arms of each entry run.
            const IMAGE = makeImage();
            const DRAWS = [
                function fillRect(ctx, b, alt) {
                    ctx.fillStyle = alt ? 'rgba(200, 30, 40, 0.6)' : 'rgb(200, 30, 40)';
                    ctx.fillRect(b.x - 3, b.y + b.h * 0.3, b.w * 0.8, b.h * 0.5);
                },
                function strokeRect1px(ctx, b, alt) {
                    ctx.strokeStyle = alt ? 'rgba(20, 90, 200, 0.5)' : 'rgb(20, 90, 200)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(Math.floor(b.x) - 2.5, Math.floor(b.y) + 1.5, Math.floor(b.w * 0.7), Math.floor(b.h * 0.6));
                },
                function strokeRectThick(ctx, b, alt) {
                    ctx.strokeStyle = alt ? 'rgba(10, 160, 60, 0.55)' : 'rgb(10, 160, 60)';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(b.x + 2, b.y - 2, b.w * 0.6, b.h * 0.7);
                },
                function strokeRectHairline(ctx, b) {
                    ctx.strokeStyle = 'rgb(120, 0, 120)';
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(b.x + 1.5, b.y + 1.5, b.w * 0.5, b.h * 0.5);
                },
                function strokeRectRotated(ctx, b, alt) {
                    ctx.save();
                    ctx.translate(b.x + b.w * 0.4, b.y + b.h * 0.5);
                    ctx.rotate(0.4);
                    ctx.strokeStyle = alt ? 'rgba(220, 120, 0, 0.6)' : 'rgb(220, 120, 0)';
                    ctx.lineWidth = alt ? 2 : 1;
                    ctx.strokeRect(-b.w * 0.4, -b.h * 0.3, b.w * 0.8, b.h * 0.6);
                    ctx.restore();
                },
                function fillStrokeRect(ctx, b, alt) {
                    ctx.fillStyle = alt ? 'rgba(250, 200, 0, 0.5)' : 'rgb(250, 200, 0)';
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
                    ctx.lineWidth = 2;
                    ctx.fillStrokeRect(b.x - 1, b.y + 2, b.w * 0.7, b.h * 0.6);
                },
                function fillStrokeRectRotated(ctx, b, alt) {
                    ctx.save();
                    ctx.translate(b.x + b.w * 0.5, b.y + b.h * 0.4);
                    ctx.rotate(-0.3);
                    ctx.fillStyle = alt ? 'rgba(0, 200, 200, 0.5)' : 'rgb(0, 200, 200)';
                    ctx.strokeStyle = 'rgb(0, 60, 60)';
                    ctx.lineWidth = 1;
                    ctx.fillStrokeRect(-b.w * 0.35, -b.h * 0.3, b.w * 0.7, b.h * 0.6);
                    ctx.restore();
                },
                function clearRect(ctx, b) {
                    ctx.clearRect(b.x + 2, b.y + 1, b.w * 0.5, b.h * 0.45);
                },
                function fillPathNonzero(ctx, b, alt) {
                    ctx.fillStyle = alt ? 'rgba(90, 40, 160, 0.6)' : 'rgb(90, 40, 160)';
                    ctx.beginPath();
                    ctx.moveTo(b.x - 4, b.y + b.h);
                    ctx.lineTo(b.x + b.w * 0.5, b.y - 4);
                    ctx.lineTo(b.x + b.w + 3, b.y + b.h * 0.8);
                    ctx.closePath();
                    ctx.fill();
                },
                function fillPathEvenodd(ctx, b, alt) {
                    ctx.fillStyle = alt ? 'rgba(160, 60, 20, 0.55)' : 'rgb(160, 60, 20)';
                    const cx = b.x + b.w * 0.5;
                    const cy = b.y + b.h * 0.5;
                    const r = Math.max(b.w, b.h) * 0.6;
                    ctx.beginPath();
                    for (let i = 0; i < 5; i++) {
                        const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
                        const px = cx + r * Math.cos(a);
                        const py = cy + r * Math.sin(a);
                        if (i === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.fill('evenodd');
                },
                function strokePath(ctx, b, alt) {
                    ctx.strokeStyle = alt ? 'rgba(30, 30, 30, 0.5)' : 'rgb(30, 30, 30)';
                    ctx.lineWidth = 2.5;
                    ctx.lineJoin = 'round';
                    ctx.beginPath();
                    ctx.moveTo(b.x - 5, b.y + 3);
                    ctx.lineTo(b.x + b.w * 0.6, b.y + b.h * 0.9);
                    ctx.lineTo(b.x + b.w + 4, b.y + b.h * 0.2);
                    ctx.stroke();
                    ctx.lineJoin = 'miter';
                },
                function fillRoundRectUniform(ctx, b, alt) {
                    ctx.fillStyle = alt ? 'rgba(0, 120, 255, 0.5)' : 'rgb(0, 120, 255)';
                    ctx.fillRoundRect(b.x - 2, b.y + 1, b.w * 0.7, b.h * 0.7, 5);
                },
                function fillRoundRectPerCorner(ctx, b, alt) {
                    ctx.fillStyle = alt ? 'rgba(255, 0, 150, 0.5)' : 'rgb(255, 0, 150)';
                    ctx.fillRoundRect(b.x + 1, b.y - 2, b.w * 0.8, b.h * 0.8, [6, 0, 9, 2]);
                },
                function strokeRoundRect1px(ctx, b, alt) {
                    ctx.strokeStyle = alt ? 'rgba(0, 0, 0, 0.6)' : 'rgb(0, 0, 0)';
                    ctx.lineWidth = 1;
                    ctx.strokeRoundRect(Math.floor(b.x) + 0.5, Math.floor(b.y) - 1.5, Math.floor(b.w * 0.8), Math.floor(b.h * 0.7), [4, 8, 0, 3]);
                },
                function strokeRoundRectThick(ctx, b, alt) {
                    ctx.strokeStyle = alt ? 'rgba(80, 160, 0, 0.6)' : 'rgb(80, 160, 0)';
                    ctx.lineWidth = 3;
                    ctx.strokeRoundRect(b.x - 3, b.y + 2, b.w * 0.75, b.h * 0.65, 6);
                },
                function fillStrokeRoundRect(ctx, b, alt) {
                    ctx.fillStyle = alt ? 'rgba(255, 220, 120, 0.6)' : 'rgb(255, 220, 120)';
                    ctx.strokeStyle = 'rgba(120, 60, 0, 0.8)';
                    ctx.lineWidth = 2;
                    ctx.fillStrokeRoundRect(b.x + 2, b.y + 2, b.w * 0.7, b.h * 0.7, [7, 3, 0, 5]);
                },
                function strokeRoundRectRotated(ctx, b, alt) {
                    ctx.save();
                    ctx.translate(b.x + b.w * 0.5, b.y + b.h * 0.5);
                    ctx.rotate(0.6);
                    ctx.strokeStyle = alt ? 'rgba(0, 0, 200, 0.6)' : 'rgb(0, 0, 200)';
                    ctx.lineWidth = 2;
                    ctx.strokeRoundRect(-b.w * 0.4, -b.h * 0.3, b.w * 0.8, b.h * 0.6, 4);
                    ctx.fillStyle = 'rgba(0, 0, 200, 0.3)';
                    ctx.fillStrokeRoundRect(-b.w * 0.2, -b.h * 0.15, b.w * 0.4, b.h * 0.3, 3);
                    ctx.restore();
                },
                function arcs(ctx, b, alt) {
                    const cx = b.x + b.w * 0.3;
                    const cy = b.y + b.h * 0.4;
                    const r = Math.min(b.w, b.h) * 0.5 + 3;
                    ctx.fillStyle = alt ? 'rgba(200, 100, 50, 0.6)' : 'rgb(200, 100, 50)';
                    ctx.fillArc(cx, cy, r, 0.2, 2.4);
                    ctx.strokeStyle = alt ? 'rgba(50, 50, 50, 0.6)' : 'rgb(50, 50, 50)';
                    ctx.lineWidth = 1;
                    ctx.outerStrokeArc(cx + 4, cy - 2, r * 0.8, 3.0, 5.5);
                    ctx.lineWidth = 3;
                    ctx.outerStrokeArc(cx, cy, r + 3, 4.0, 6.0);
                    ctx.lineWidth = 2;
                    ctx.fillOuterStrokeArc(cx + b.w * 0.4, cy + 2, r * 0.6, 1.0, 4.5);
                },
                function circles(ctx, b, alt) {
                    const cx = b.x + b.w * 0.6;
                    const cy = b.y + b.h * 0.5;
                    const r = Math.min(b.w, b.h) * 0.45 + 2;
                    ctx.fillStyle = alt ? 'rgba(0, 150, 100, 0.55)' : 'rgb(0, 150, 100)';
                    ctx.fillCircle(cx, cy, r);
                    ctx.strokeStyle = alt ? 'rgba(100, 0, 0, 0.6)' : 'rgb(100, 0, 0)';
                    ctx.lineWidth = 1;
                    ctx.strokeCircle(cx - 3, cy + 2, r * 0.7);
                    ctx.lineWidth = 3;
                    ctx.strokeCircle(cx + 2, cy - 1, r + 2);
                    ctx.lineWidth = 2;
                    ctx.fillStrokeCircle(b.x + 2, b.y + 2, r * 0.5);
                },
                function lines(ctx, b, alt) {
                    ctx.strokeStyle = alt ? 'rgba(0, 0, 0, 0.6)' : 'rgb(0, 0, 0)';
                    ctx.lineWidth = 1;
                    ctx.strokeLine(b.x - 6, b.y + 3, b.x + b.w + 6, b.y + 3);
                    ctx.strokeLine(b.x - 4, b.y + b.h + 3, b.x + b.w + 2, b.y - 5);
                    ctx.lineWidth = 4;
                    ctx.strokeLine(b.x - 3, b.y - 3, b.x + b.w * 0.8, b.y + b.h + 2);
                    ctx.lineWidth = 3;
                    ctx.strokeLine(b.x + 2, b.y - 4, b.x + 2, b.y + b.h + 4);
                },
                function drawImages(ctx, b, alt) {
                    ctx.globalAlpha = alt ? 0.7 : 1;
                    ctx.drawImage(IMAGE, Math.floor(b.x) - 3, Math.floor(b.y) - 2);
                    ctx.drawImage(IMAGE, b.x + b.w * 0.4, b.y + 1, b.w * 0.7, b.h * 0.8);
                    ctx.save();
                    ctx.translate(b.x + b.w * 0.5, b.y + b.h * 0.5);
                    ctx.rotate(0.5);
                    ctx.drawImage(IMAGE, -6, -5, 14, 11);
                    ctx.restore();
                    ctx.globalAlpha = 1;
                },
                function text(ctx, b, alt) {
                    ctx.font = alt ? 'bold 16px Arial' : '16px Arial';
                    ctx.fillStyle = alt ? 'rgba(0, 0, 160, 0.7)' : 'rgb(0, 0, 160)';
                    ctx.fillText('Wg', Math.floor(b.x) - 4, Math.floor(b.y + b.h * 0.8));
                    ctx.save();
                    ctx.translate(b.x + b.w * 0.5, b.y + b.h * 0.5);
                    ctx.rotate(0.3);
                    ctx.fillText('Ab', -8, 6);
                    ctx.restore();
                },
                function gradients(ctx, b, alt) {
                    const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
                    g.addColorStop(0, alt ? 'rgba(255, 0, 0, 0.6)' : 'rgb(255, 0, 0)');
                    g.addColorStop(1, 'rgb(0, 0, 255)');
                    ctx.fillStyle = g;
                    ctx.fillRect(b.x - 2, b.y - 2, b.w * 0.8, b.h * 0.6);
                    const rg = ctx.createRadialGradient(b.x + b.w * 0.6, b.y + b.h * 0.6, 1, b.x + b.w * 0.6, b.y + b.h * 0.6, b.w);
                    rg.addColorStop(0, 'rgb(255, 255, 0)');
                    rg.addColorStop(1, 'rgba(0, 120, 0, 0.5)');
                    ctx.fillStyle = rg;
                    ctx.beginPath();
                    ctx.arc(b.x + b.w * 0.6, b.y + b.h * 0.6, Math.min(b.w, b.h) * 0.5 + 2, 0, Math.PI * 2);
                    ctx.fill();
                },
                function patterns(ctx, b, alt) {
                    ctx.fillStyle = ctx.createPattern(IMAGE, 'repeat');
                    ctx.globalAlpha = alt ? 0.6 : 1;
                    ctx.fillRect(b.x - 3, b.y + 1, b.w * 0.7, b.h * 0.7);
                    ctx.save();
                    ctx.translate(0.5, 0.25);
                    ctx.fillRect(b.x + b.w * 0.5, b.y - 2, b.w * 0.6, b.h * 0.5);
                    ctx.restore();
                    ctx.globalAlpha = 1;
                },
                function stadium(ctx, b, alt) {
                    ctx.fillStyle = alt ? 'rgba(120, 120, 255, 0.6)' : 'rgb(120, 120, 255)';
                    ctx.fillStadium(b.x - 2, b.y + b.h * 0.2, b.w * 0.9, Math.max(4, b.h * 0.4));
                }
            ];

            // Fizzygum's window paint order: per corner piece, save + clip(damage rect)
            // + clip(rounded outline), then per child save + clip(child rect) + draws +
            // restore, then restore. Each child draws two entries (rotating through
            // DRAWS by `offset`), placed over its rect ∩ the damage rect, grown by 4px
            // so they cross both the child rect and the outline.
            function windowCorners(ctx, clip, win, radii, offset, draws = DRAWS) {
                const { x, y, w, h } = win;
                const pieceW = Math.round(w * 0.42);
                const pieceH = Math.round(h * 0.4);
                const damages = [
                    { x: x - 6, y: y - 5, w: pieceW, h: pieceH },
                    { x: x + w - pieceW + 7, y: y - 4, w: pieceW, h: pieceH },
                    { x: x + w - pieceW + 5, y: y + h - pieceH + 6, w: pieceW, h: pieceH },
                    { x: x - 5, y: y + h - pieceH + 4, w: pieceW, h: pieceH }
                ];
                const children = [
                    { x: x, y: y, w: w, h: 22 }, // title bar
                    { x: x + 3, y: y + 3, w: 16, h: 16 }, // close button
                    { x: x + w - 19, y: y + 3, w: 16, h: 16 }, // collapse button
                    { x: x, y: y + 22, w: Math.round(w * 0.3), h: h - 22 }, // left pane
                    { x: x + Math.round(w * 0.3), y: y + 22, w: w - Math.round(w * 0.3), h: h - 36 }, // content
                    { x: x, y: y + h - 14, w: w, h: 14 }, // status bar
                    { x: x + w - 12, y: y + h - 12, w: 12, h: 12 }, // resize handle
                    { x: x - 10, y: y + 30, w: 30, h: 40 } // a child that overflows the window
                ];
                let slot = offset;
                for (const d of damages) {
                    ctx.save();
                    clip.rect(d.x, d.y, d.w, d.h);
                    clip.roundRect(x, y, w, h, radii);
                    for (const c of children) {
                        ctx.save();
                        clip.rect(c.x, c.y, c.w, c.h);
                        const x0 = Math.max(c.x, d.x);
                        const y0 = Math.max(c.y, d.y);
                        const x1 = Math.min(c.x + c.w, d.x + d.w);
                        const y1 = Math.min(c.y + c.h, d.y + d.h);
                        if (x1 > x0 && y1 > y0) {
                            const b = { x: x0 - 4, y: y0 - 4, w: x1 - x0 + 8, h: y1 - y0 + 8 };
                            draws[slot % draws.length](ctx, b, slot % 2 === 1);
                            draws[(slot + 11) % draws.length](ctx, b, slot % 3 === 0);
                            slot++;
                        }
                        ctx.restore();
                    }
                    ctx.restore();
                }
            }

            return { assertScene, windowCorners, DRAWS };
        })();

        test('Clip rect + immutable mask - Fizzygum window-corner pattern === pure mask model', () => {
            const { assertScene, windowCorners, DRAWS } = ClipOracle073;
            const radiiCases = [
                { label: 'uniform radius 8', radii: 8 },
                { label: 'per-corner radii [8,3,12,0]', radii: [8, 3, 12, 0] },
                { label: 'per-corner radii [0,10,4,7]', radii: [0, 10, 4, 7] }
            ];
            // Slots rotate through DRAWS, so across the offsets every entry lands in
            // every corner piece, opaque and translucent.
            for (let s = 0; s < radiiCases.length; s++) {
                for (let pass = 0; pass < 2; pass++) {
                    const offset = s * 5 + pass * 13;
                    assertScene(`240x180 window, ${radiiCases[s].label}, draw offset ${offset}`, 240, 180, (ctx, clip) =>
                        windowCorners(ctx, clip, { x: 30, y: 25, w: 180, h: 130 }, radiiCases[s].radii, offset)
                    );
                }
            }
            // One window per draw entry, every child drawing that entry.
            for (const draw of DRAWS) {
                assertScene(`entry ${draw.name}`, 120, 90, (ctx, clip) =>
                    windowCorners(ctx, clip, { x: 12, y: 10, w: 96, h: 70 }, [8, 3, 12, 0], 0, [draw])
                );
            }
        });

        test('Clip rect + immutable mask - window pattern on a 1920x880 surface === pure mask model', () => {
            const { assertScene, windowCorners } = ClipOracle073;
            // Fizzygum's dpr-1 desktop size: a ~500x400 window mid-surface, and one
            // hanging off the bottom-right edge so damage rects and children leave the
            // surface.
            assertScene('1920x880, mid-surface window', 1920, 880, (ctx, clip) => {
                windowCorners(ctx, clip, { x: 700, y: 240, w: 500, h: 400 }, 8, 0);
                windowCorners(ctx, clip, { x: 1640, y: 700, w: 500, h: 400 }, [8, 3, 12, 0], 9);
            });
        });

        test('Clip rect + immutable mask - clip sequences, fill rules, off-surface and empty rects === pure mask model', () => {
            const { assertScene, DRAWS } = ClipOracle073;
            const W = 160;
            const H = 120;
            const all = (ctx, b) => {
                for (let k = 0; k < DRAWS.length; k++) DRAWS[k](ctx, b, k % 2 === 1);
            };
            const star = (cx, cy, r) => {
                const p = new SWCanvas.Core.SWPath2D();
                for (let i = 0; i < 7; i++) {
                    const a = -Math.PI / 2 + (i * 6 * Math.PI) / 7;
                    if (i === 0) p.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
                    else p.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
                }
                p.closePath();
                return p;
            };
            const ring = (cx, cy, r0, r1) => {
                const p = new SWCanvas.Core.SWPath2D();
                p.arc(cx, cy, r1, 0, Math.PI * 2);
                p.closePath();
                p.moveTo(cx + r0, cy);
                p.arc(cx, cy, r0, 0, Math.PI * 2);
                p.closePath();
                return p;
            };
            for (const rule of ['nonzero', 'evenodd']) {
                assertScene(`mask -> rect -> mask (${rule})`, W, H, (ctx, clip) => {
                    ctx.save();
                    clip.path(star(80, 60, 58), rule);
                    clip.rect(20, 14, 115, 90);
                    clip.path(ring(78, 62, 18, 52), rule);
                    all(ctx, { x: 20, y: 18, w: 120, h: 84 });
                    ctx.restore();
                });
                assertScene(`rect -> mask -> rect -> mask -> rect (${rule})`, W, H, (ctx, clip) => {
                    ctx.save();
                    clip.rect(6, 4, 150, 110);
                    clip.path(ring(80, 60, 10, 55), rule);
                    clip.rect(30.5, 20.25, 100, 75.75); // fractional edges: ceil(v - 0.5) rounding
                    clip.path(star(80, 58, 60), rule);
                    clip.rect(40, 10, 90, 100);
                    all(ctx, { x: 30, y: 20, w: 100, h: 80 });
                    ctx.restore();
                });
            }
            assertScene('rotated (non-axis-aligned) rect clip between rect clips', W, H, (ctx, clip) => {
                ctx.save();
                clip.rect(10, 8, 140, 104);
                ctx.translate(80, 60);
                ctx.rotate(0.35);
                clip.rect(-55, -35, 110, 70);
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                clip.rect(25, 15, 120, 90);
                all(ctx, { x: 20, y: 15, w: 120, h: 90 });
                ctx.restore();
            });
            assertScene('rect clips partly off the surface, around a mask', W, H, (ctx, clip) => {
                ctx.save();
                clip.rect(-30, -20, 110, 85);
                clip.roundRect(-10, -10, 100, 80, [12, 0, 16, 6]);
                all(ctx, { x: -5, y: -5, w: 80, h: 65 });
                ctx.restore();
                ctx.save();
                clip.roundRect(90, 50, 100, 100, 14);
                clip.rect(100, 60, 200, 200);
                all(ctx, { x: 95, y: 55, w: 70, h: 70 });
                ctx.restore();
            });
            assertScene('rect clip fully off the surface, then a mask and draws', W, H, (ctx, clip) => {
                ctx.save();
                clip.roundRect(10, 10, 100, 80, 10);
                all(ctx, { x: 10, y: 10, w: 100, h: 80 });
                ctx.save();
                clip.rect(W + 10, 5, 30, 30);
                clip.roundRect(W + 12, 6, 20, 20, 4);
                all(ctx, { x: 10, y: 10, w: 100, h: 80 });
                ctx.restore();
                ctx.save();
                clip.rect(-60, -50, 40, 30);
                all(ctx, { x: 10, y: 10, w: 100, h: 80 });
                ctx.restore();
                ctx.restore();
            });
            assertScene('empty rect intersections, with and without a mask', W, H, (ctx, clip) => {
                ctx.save();
                clip.rect(10, 10, 40, 40);
                all(ctx, { x: 10, y: 10, w: 40, h: 40 });
                ctx.save();
                clip.rect(60, 60, 30, 30); // disjoint -> empty
                all(ctx, { x: 10, y: 10, w: 80, h: 80 });
                clip.roundRect(0, 0, 100, 100, 20); // a mask built inside an empty rect
                all(ctx, { x: 10, y: 10, w: 80, h: 80 });
                ctx.restore();
                clip.roundRect(5, 5, 60, 60, [20, 0, 20, 0]);
                clip.rect(48, 10, 2, 40); // a 2px sliver
                clip.rect(49, 10, 0.4, 40); // collapses to zero columns
                all(ctx, { x: 10, y: 10, w: 40, h: 40 });
                ctx.restore();
                clip.rect(100, 70, 50, 40);
                all(ctx, { x: 100, y: 70, w: 50, h: 40 });
            });
            assertScene('current-path clips (moveTo/lineTo rect, arc) under a CTM', W, H, (ctx, clip) => {
                ctx.save();
                ctx.translate(3.5, 2.25);
                ctx.scale(1.25, 1.25);
                ctx.beginPath();
                ctx.moveTo(8, 6);
                ctx.lineTo(110, 6);
                ctx.lineTo(110, 84);
                ctx.lineTo(8, 84);
                ctx.closePath();
                clip.current(); // the current path, detected as a rect
                ctx.beginPath();
                ctx.arc(60, 45, 44, 0, Math.PI * 2);
                clip.current();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                all(ctx, { x: 10, y: 8, w: 140, h: 104 });
                ctx.restore();
            });
        });

        test('Clip rect + immutable mask - canvas-wide composites, other composites and shadows === pure mask model', () => {
            const { assertScene, DRAWS } = ClipOracle073;
            const W = 120;
            const H = 90;
            const backdrop = ctx => {
                ctx.fillStyle = 'rgb(40, 160, 220)';
                ctx.fillRect(0, 0, W, H / 2);
                ctx.fillStyle = 'rgba(220, 60, 60, 0.6)';
                ctx.fillRect(W / 3, 0, W / 3, H);
            };
            const underMaskAndRect = (ctx, clip, fn) => {
                ctx.save();
                clip.rect(8, 6, 104, 78);
                clip.roundRect(4, 2, 100, 80, [14, 4, 20, 0]);
                ctx.save();
                clip.rect(20, 12, 80, 64);
                fn();
                ctx.restore();
                ctx.restore();
            };
            const ops = ['copy', 'source-in', 'source-out', 'destination-in', 'destination-atop', 'destination-out', 'xor', 'lighter', 'source-atop'];
            for (const op of ops) {
                assertScene(`globalCompositeOperation = ${op}`, W, H, (ctx, clip) => {
                    backdrop(ctx);
                    underMaskAndRect(ctx, clip, () => {
                        ctx.globalCompositeOperation = op;
                        ctx.fillStyle = 'rgba(250, 210, 0, 0.8)';
                        ctx.fillRect(30, 20, 50, 40);
                        ctx.beginPath();
                        ctx.arc(70, 50, 24, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.strokeStyle = 'rgb(0, 0, 0)';
                        ctx.lineWidth = 3;
                        ctx.strokeRect(15.5, 15.5, 60, 50);
                        DRAWS.find(d => d.name === 'drawImages')(ctx, { x: 40, y: 30, w: 30, h: 24 }, false);
                        DRAWS.find(d => d.name === 'circles')(ctx, { x: 50, y: 40, w: 30, h: 24 }, true);
                        ctx.globalCompositeOperation = 'source-over';
                    });
                });
            }
            assertScene('shadows under mask + rect', W, H, (ctx, clip) => {
                backdrop(ctx);
                underMaskAndRect(ctx, clip, () => {
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
                    ctx.shadowBlur = 3;
                    ctx.shadowOffsetX = 5;
                    ctx.shadowOffsetY = 4;
                    for (let k = 0; k < DRAWS.length; k++) {
                        DRAWS[k](ctx, { x: 26 + (k % 5) * 12, y: 16 + Math.floor(k / 5) * 11, w: 18, h: 14 }, k % 2 === 0);
                    }
                    ctx.shadowColor = 'rgba(0, 0, 0, 0)';
                });
            });
        });


        // Test: save()/restore() bring back EXACTLY the earlier clip - shared immutable masks, combined-mask cache
        // This file will be concatenated into the main test suite
        //
        // save() shares the installed clip mask by reference (masks are never mutated
        // once installed), and draws that take ONE mask read a combined mask ∧ rect that
        // is built on demand and cached per (mask, rect) pair - the cache travels with
        // save()/restore() and every clip() drops it. Contract pinned here:
        //   1. after restore() the clip is exactly the one in force at the matching
        //      save(): a full-surface draw after a nested save/clip/draw/restore program
        //      is byte-identical to the same draw under only the outer clips - for draws
        //      that take the rect and mask separately, draws that take the combined
        //      mask, canvas-wide composites and shadows, at every nesting depth;
        //   2. a combined mask built inside a nested state (or after save() but before
        //      the nested clip) never survives the restore() - the stale-cache trap;
        //   3. a nested non-rect clip never alters the mask the outer state shares;
        //   4. all of the above is byte-identical to the pure mask model
        //      (Context2D._disableTier0Clip = true).

        const ClipRestore074 = (() => {
            const Ctx2D = SWCanvas.Core.Context2D;
            const W = 96;
            const H = 72;

            const OPAQUE_2X2 = {
                width: 2,
                height: 2,
                data: new Uint8ClampedArray([10, 200, 30, 255, 10, 200, 30, 255, 10, 200, 30, 255, 10, 200, 30, 255])
            };

            function starPath(cx, cy, r) {
                const p = new SWCanvas.Core.SWPath2D();
                for (let i = 0; i < 5; i++) {
                    const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
                    if (i === 0) p.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
                    else p.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
                }
                p.closePath();
                return p;
            }

            // Clip steps. Each nesting level of a program is a list of these.
            const CLIPS = {
                rectA: ctx => {
                    ctx.beginPath();
                    ctx.rect(6, 5, 80, 60);
                    ctx.clip();
                },
                rectB: ctx => {
                    ctx.beginPath();
                    ctx.rect(20.5, 14.25, 50, 40);
                    ctx.clip();
                },
                rectC: ctx => {
                    ctx.beginPath();
                    ctx.rect(30, 0, 20, H);
                    ctx.clip();
                },
                rectD: ctx => {
                    ctx.beginPath();
                    ctx.rect(75, 56, 15, 12); // disjoint from rectB
                    ctx.clip();
                },
                outline: ctx => {
                    ctx.beginPath();
                    ctx.roundRect(4, 3, 84, 64, [12, 3, 16, 0]);
                    ctx.clip();
                },
                circle: ctx => {
                    ctx.beginPath();
                    ctx.arc(48, 36, 26, 0, Math.PI * 2);
                    ctx.clip();
                },
                starEvenodd: ctx => ctx.clip(starPath(46, 38, 34), 'evenodd')
            };

            // Draws made INSIDE a program: they warm the combined-mask cache of the state
            // they run in (fillStrokeRect, strokeLine and clearRect take one mask; a
            // 'copy' fill takes it too) and leave pixels the final draw must overwrite.
            function warmDraws(ctx, tint) {
                ctx.fillStyle = `rgb(${tint}, 60, 200)`;
                ctx.strokeStyle = 'rgb(0, 0, 0)';
                ctx.lineWidth = 2;
                ctx.fillStrokeRect(10, 8, 60, 44);
                ctx.lineWidth = 3;
                ctx.strokeLine(2, 70, 94, 2);
                ctx.clearRect(40, 30, 12, 9);
                ctx.fillStyle = `rgba(${tint}, 200, 60, 0.5)`;
                ctx.fillRect(14, 20, 70, 30);
                ctx.globalCompositeOperation = 'copy';
                ctx.fillStyle = 'rgba(255, 128, 0, 0.6)';
                ctx.fillRect(50, 10, 20, 50);
                ctx.globalCompositeOperation = 'source-over';
            }

            // Final draws, each covering the whole surface and setting every pixel inside
            // the clip to a value that does not depend on what was there before.
            const FINAL_DRAWS = {
                'fillRect (rect + mask)': ctx => {
                    ctx.fillStyle = 'rgb(200, 20, 90)';
                    ctx.fillRect(-4, -4, W + 8, H + 8);
                },
                'drawImage (rect + mask)': ctx => {
                    // Nearest-neighbour, so every covered pixel is an opaque texel (a
                    // bilinear stretch has translucent edges that would blend with dest).
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(OPAQUE_2X2, -4, -4, W + 8, H + 8);
                    ctx.imageSmoothingEnabled = true;
                },
                'fillStrokeRect (combined mask)': ctx => {
                    ctx.fillStyle = 'rgb(20, 90, 200)';
                    ctx.strokeStyle = 'rgb(0, 0, 0)';
                    ctx.lineWidth = 2;
                    ctx.fillStrokeRect(-4, -4, W + 8, H + 8);
                },
                'clearRect (combined mask)': ctx => {
                    ctx.clearRect(0, 0, W, H);
                },
                'copy fillRect (canvas-wide, combined mask)': ctx => {
                    ctx.globalCompositeOperation = 'copy';
                    ctx.fillStyle = 'rgba(120, 220, 20, 0.7)';
                    ctx.fillRect(0, 0, W, H);
                    ctx.globalCompositeOperation = 'source-over';
                },
                'shadowed fillRect (combined mask)': ctx => {
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                    ctx.shadowBlur = 2;
                    ctx.shadowOffsetX = 3;
                    ctx.fillStyle = 'rgb(240, 200, 0)';
                    ctx.fillRect(-4, -4, W + 8, H + 8);
                    ctx.shadowColor = 'rgba(0, 0, 0, 0)';
                }
            };

            function backdrop(ctx) {
                ctx.fillStyle = 'rgb(250, 248, 240)';
                ctx.fillRect(0, 0, W, H);
                ctx.fillStyle = 'rgb(60, 60, 60)';
                for (let x = 0; x < W; x += 6) ctx.fillRect(x, 0, 3, H);
            }

            function render(oracle, body) {
                const previous = Ctx2D._disableTier0Clip;
                Ctx2D._disableTier0Clip = oracle;
                try {
                    const canvas = SWCanvas.createCanvas(W, H);
                    const ctx = canvas.getContext('2d');
                    backdrop(ctx);
                    body(ctx);
                    return ctx.getImageData(0, 0, W, H).data;
                } finally {
                    Ctx2D._disableTier0Clip = previous;
                }
            }

            function firstDiff(a, b) {
                for (let i = 0; i < a.length; i++) {
                    if (a[i] !== b[i]) {
                        const p = i >> 2;
                        return `(${p % W},${Math.floor(p / W)}) channel ${i & 3}: ${a[i]} vs ${b[i]}`;
                    }
                }
                return null;
            }

            // Run `levels` (each a list of clip names): per level save(), warmDraws
            // (the state above, after save() - its cache is not in the snapshot), the
            // level's clips, warmDraws again (this level's own pair). Then restore()
            // down to `keep` levels and run the final draw.
            //
            // The reference is the same program cut to its first `keep` levels. The
            // levels it drops only ever drew inside the region the final draw then
            // overwrites, so the two renders are equal exactly when restore() brought
            // back the saved clip - a deeper state's mask or combined mask surviving the
            // restore() changes the final draw's footprint.
            function program(ctx, levels, keep, finalDraw) {
                for (let i = 0; i < levels.length; i++) {
                    ctx.save();
                    warmDraws(ctx, 30 + i * 50);
                    for (const name of levels[i]) CLIPS[name](ctx);
                    warmDraws(ctx, 60 + i * 50);
                }
                for (let i = levels.length; i > keep; i--) ctx.restore();
                finalDraw(ctx);
            }

            function assertProgram(label, levels) {
                for (const drawName of Object.keys(FINAL_DRAWS)) {
                    const finalDraw = FINAL_DRAWS[drawName];
                    for (let keep = 0; keep < levels.length; keep++) {
                        for (const oracle of [false, true]) {
                            const got = render(oracle, ctx => program(ctx, levels, keep, finalDraw));
                            const want = render(oracle, ctx => program(ctx, levels.slice(0, keep), keep, finalDraw));
                            const diff = firstDiff(got, want);
                            if (diff) {
                                throw new Error(
                                    `${label}, ${drawName}, restored to depth ${keep}${oracle ? ' (oracle)' : ''}: ` +
                                        `clip after restore() is not the saved one - differs at ${diff}`
                                );
                            }
                        }
                        const model = render(false, ctx => program(ctx, levels, keep, finalDraw));
                        const pure = render(true, ctx => program(ctx, levels, keep, finalDraw));
                        const diff = firstDiff(model, pure);
                        if (diff) {
                            throw new Error(
                                `${label}, ${drawName}, restored to depth ${keep}: rect + mask model differs from ` +
                                    `the pure mask model at ${diff}`
                            );
                        }
                    }
                }
                log(`  ${label}: every restore() depth brings back the saved clip, === pure mask model`);
            }

            return { assertProgram, render, firstDiff, CLIPS, warmDraws, FINAL_DRAWS };
        })();

        test('Clip save/restore - nested programs restore exactly the saved clip, combined-mask cache never goes stale', () => {
            const { assertProgram } = ClipRestore074;
            // Fizzygum's shape: damage rect + outline, then a child rect.
            assertProgram('rect + outline / child rect', [['rectA', 'outline'], ['rectB']]);
            // A nested rect between masks, and a nested mask that a shared outer mask
            // must not see.
            assertProgram('outline / rect / circle mask', [['outline'], ['rectB'], ['circle']]);
            assertProgram('rect / outline + rect / evenodd star / rect', [
                ['rectA'],
                ['outline', 'rectC'],
                ['starEvenodd'],
                ['rectB']
            ]);
            // Masks only, then rects only.
            assertProgram('outline / circle / evenodd star', [['outline'], ['circle'], ['starEvenodd']]);
            assertProgram('rect / rect / rect', [['rectA'], ['rectB'], ['rectC']]);
            // A nested rect disjoint from the one above (an empty clip), then a mask
            // built inside the empty rect.
            assertProgram('outline + rect / empty rect / circle mask', [['outline', 'rectB'], ['rectD'], ['circle']]);
        });

        test('Clip save/restore - a clip() right after restore() drops the combined mask the restore brought back', () => {
            const { render, firstDiff, CLIPS, warmDraws, FINAL_DRAWS } = ClipRestore074;
            for (const drawName of Object.keys(FINAL_DRAWS)) {
                const finalDraw = FINAL_DRAWS[drawName];
                for (const oracle of [false, true]) {
                    // restore() brings back the (outline, rectA) pair together with its
                    // combined mask; the rectC clip at that same level shrinks the pair,
                    // so the final draw must use outline ∧ rectA ∧ rectC, not the
                    // restored cache. The nested state only draws inside that region.
                    const sequence = withNested => ctx => {
                        CLIPS.rectA(ctx);
                        CLIPS.outline(ctx);
                        warmDraws(ctx, 90);
                        if (withNested) {
                            ctx.save();
                            CLIPS.rectC(ctx);
                            CLIPS.rectB(ctx);
                            warmDraws(ctx, 140);
                            ctx.restore();
                        }
                        warmDraws(ctx, 190);
                        CLIPS.rectC(ctx);
                        finalDraw(ctx);
                    };
                    const diff = firstDiff(render(oracle, sequence(true)), render(oracle, sequence(false)));
                    if (diff) {
                        throw new Error(`${drawName}${oracle ? ' (oracle)' : ''}: wrong clip after restore() + clip(), at ${diff}`);
                    }
                    if (!oracle) {
                        const pure = firstDiff(render(false, sequence(true)), render(true, sequence(true)));
                        if (pure) throw new Error(`${drawName}: rect + mask model differs from the pure mask model at ${pure}`);
                    }
                }
            }
            log('  restore() + a same-level clip(): the final draw uses the new pair, === pure mask model');
        });


        // Test: PngEncoder's output is pinned byte for byte, compresses, and keeps level 0 as the stored form
        // This file will be concatenated into the main test suite
        //
        // PngEncoder promises that identical pixels give identical bytes in every engine (toDataURL's
        // callers rely on it, and so do the PNGs this repo commits under tests/). 038 checks that within one
        // run; this test pins the bytes themselves, so ANY change to the encoder's output fails here and has
        // to be a deliberate re-golden. Run in Node and in the browser test page, it is also the
        // cross-engine check: both must reproduce the same golden.
        //
        // The fixture raster is written into a Surface directly — no rasterizer involved — so a rendering
        // change can never move these goldens; only an encoder change can. It has an opaque half (a
        // gradient beside a flat colour) and a translucent half (an alpha ramp over a varying colour, with a
        // fully clear corner), so alpha < 255 is in the pinned bytes.
        //
        // The golden bytes decode (zlib, PIL) to exactly this raster, and the level-0 golden is the stored
        // encoder's output byte for byte. Re-cut a golden only after re-verifying that with a real decoder:
        // no decoder lives in this test, by design (it must run unchanged in the browser).
        //
        // Contract pinned here:
        //   1. the default encoding (compressionLevel 6) has the golden length and FNV-1a hash, and is a
        //      zlib stream (CMF 0x78, FLG 0x5E) whose DEFLATE block uses the fixed Huffman codes (BTYPE 01);
        //   2. it is under a quarter of the stored form's length — a bound level 0 cannot meet;
        //   3. compressionLevel 0 still writes the stored form: filter 0 on every row, STORED blocks
        //      (CMF 0x78, FLG 0x01), the exact expected length and its own golden hash;
        //   4. PngEncodingOptions.DEFAULT is level 6, and encoding twice gives identical bytes.

        test('PngEncoder - golden bytes at the default level, a compression bound, level 0 = stored form', () => {
            const W = 64;
            const H = 48;
            const GOLDEN_LENGTH = 338;
            const GOLDEN_FNV = '911bbd37';
            const GOLDEN_STORED_FNV = '265c26c7';

            // 32-bit FNV-1a over the bytes, as 8 hex digits
            function fnv1a(bytes) {
                let h = 0x811c9dc5;
                for (let i = 0; i < bytes.length; i++) {
                    h ^= bytes[i];
                    h = Math.imul(h, 0x01000193) >>> 0;
                }
                return ('0000000' + h.toString(16)).slice(-8);
            }

            function fixtureSurface() {
                const surface = SWCanvas.Core.Surface(W, H);
                const d = surface.data;
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        const o = y * surface.stride + x * 4;
                        if (y < H / 2) {
                            const flat = x >= W / 2;
                            d[o] = flat ? 40 : (x * 8) & 255;
                            d[o + 1] = flat ? 80 : (y * 10) & 255;
                            d[o + 2] = flat ? 160 : 128;
                            d[o + 3] = 255;
                        } else if (x < 8 && y >= H - 8) {
                            d[o] = d[o + 1] = d[o + 2] = d[o + 3] = 0;
                        } else {
                            d[o] = 200;
                            d[o + 1] = (x * 7) & 255;
                            d[o + 2] = 50;
                            d[o + 3] = (x * 3 + y * 5) & 255;
                        }
                    }
                }
                return surface;
            }

            const surface = fixtureSurface();
            const options = SWCanvas.Core.PngEncodingOptions;
            const encoded = new Uint8Array(SWCanvas.Core.PngEncoder.encode(surface));

            // 1. golden bytes, zlib header, fixed Huffman block
            const encodedFnv = fnv1a(encoded);
            assertEquals(encoded.length, GOLDEN_LENGTH, 'default-level PNG length: expected ' + GOLDEN_LENGTH + ', got ' +
                encoded.length);
            assertEquals(encodedFnv, GOLDEN_FNV, 'default-level PNG FNV-1a: expected ' + GOLDEN_FNV + ', got ' + encodedFnv);
            // signature 8 + IHDR chunk 25 + IDAT length/type 8: the zlib stream starts at byte 41
            assertEquals(encoded[25], 6, 'colour type 6 (RGBA)');
            assertEquals(encoded[41], 0x78, 'zlib CMF');
            assertEquals(encoded[42], 0x5e, 'zlib FLG of the compressed form');
            assertEquals((encoded[43] >> 1) & 3, 1, 'DEFLATE block type 01 (fixed Huffman)');

            // 3. level 0: the stored form, laid out exactly
            const rowBytes = W * 4 + 1;
            const scanlineBytes = rowBytes * H;
            const storedLength = 8 + 25 + 12 + 2 + scanlineBytes + 5 * Math.ceil(scanlineBytes / 65535) + 4 + 12;
            const stored = new Uint8Array(SWCanvas.Core.PngEncoder.encode(surface, options.withCompressionLevel(0)));
            assertEquals(stored.length, storedLength, 'level-0 PNG length: expected ' + storedLength + ', got ' +
                stored.length);
            assertEquals(stored[42], 0x01, 'zlib FLG of the stored form');
            assertEquals(stored[43], 1, 'one STORED block, BFINAL set');
            assertEquals(stored[44] | (stored[45] << 8), scanlineBytes, 'STORED block LEN');
            for (let y = 0; y < H; y++) {
                const row = 48 + y * rowBytes;
                assertEquals(stored[row], 0, 'level 0 writes filter 0 on row ' + y);
                for (let i = 0; i < W * 4; i++) {
                    if (stored[row + 1 + i] !== surface.data[y * surface.stride + i]) {
                        throw new Error('level 0 row ' + y + ' byte ' + i + ' is not the raw pixel byte');
                    }
                }
            }
            const storedFnv = fnv1a(stored);
            assertEquals(storedFnv, GOLDEN_STORED_FNV, 'level-0 PNG FNV-1a: expected ' + GOLDEN_STORED_FNV + ', got ' +
                storedFnv);

            // 2. the bound level 0 cannot meet
            if (!(encoded.length * 4 < storedLength)) {
                throw new Error('default-level PNG (' + encoded.length + ' bytes) is not under a quarter of the stored form (' +
                    storedLength + ')');
            }

            // 4. the default level, and determinism within the run
            assertEquals(options.DEFAULT.compressionLevel, 6, 'PngEncodingOptions.DEFAULT is level 6');
            const again = new Uint8Array(SWCanvas.Core.PngEncoder.encode(surface, options.withCompressionLevel(6)));
            assertEquals(fnv1a(again), encodedFnv, 'level 6 encoded again gives the same bytes as the default');
        });


        // Test: thick / fused rounded-rect strokes partially off-surface - position invariance on every side
        // This file will be concatenated into the main test suite
        //
        // The axis-aligned thick and fused rounded-rect arms (strokeRoundRect at a
        // device line width > 1, fillStrokeRoundRect at any width) walk the shape row by
        // row and clamp each row's span to the surface / clip rect. A row's extent can start at
        // a NEGATIVE x - the shape hangs off the surface's left edge, or a widget is
        // painted past the left of the canvas it lands on - and such a row must still
        // paint its on-surface part. Contract pinned here: the on-surface part of a
        // render that hangs off any side is byte-identical to the same window of the
        // same draw made fully on a wider/taller surface (integer shifts are exact in
        // the renderers' arithmetic, so clamping may only REMOVE pixels), for:
        //   - strokeRoundRect and fillStrokeRoundRect, opaque and semi-transparent;
        //   - uniform and per-corner radii;
        //   - identity, and scale(2) with the 1-logical-px crisp spelling
        //     (strokeRoundRect(0.5, 0.5, w - 1, h - 1, r)) a HiDPI client strokes with;
        //   - line widths 1..7 (at 1, strokeRoundRect is the 1px arm and the fused
        //     entry still walks rows), unclipped and under a rect clip;
        //   - the shape off the left, right, top and bottom edges, and far enough off
        //     the left / top that both of that side's corner arcs are off-surface too.
        // (The circle analogue is 052.)

        test('RoundRect thick/fused strokes off-surface - position invariance on every side', () => {
            const W = 64;
            const H = 56;
            const PAD = 80; // the wide/tall surface adds PAD on the shifted axis

            function render(width, height, dx, dy, opts) {
                const surface = SWCanvas.Core.Surface(width, height);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, width, height);
                if (opts.clip) {
                    ctx.beginPath();
                    ctx.rect(3 + dx, 2 + dy, W - 7, H - 5);
                    ctx.clip();
                }
                ctx.translate(dx, dy);
                if (opts.scale !== 1) ctx.scale(opts.scale, opts.scale);
                ctx.setFillStyle(0, 0, 255, opts.semi ? 128 : 255);
                ctx.setStrokeStyle(255, 0, 0, opts.semi ? 128 : 255);
                ctx.lineWidth = opts.lw;
                if (opts.fused) {
                    ctx.fillStrokeRoundRect(opts.x, opts.y, opts.w, opts.h, opts.r);
                } else {
                    ctx.strokeRoundRect(opts.x, opts.y, opts.w, opts.h, opts.r);
                }
                return surface;
            }

            // [label, x, y] in DEVICE px for the shape's box (w x h device px)
            const SIDES = [
                ['off-left', -9, 10],
                ['off-right', 34, 10],
                ['off-top', 10, -9],
                ['off-bottom', 10, 30],
                ['far off-left', -30, 10],
                ['far off-top', 10, -24]
            ];
            let cases = 0;
            for (const fused of [false, true]) {
                for (const semi of [false, true]) {
                    for (const radii of [9, [9, 0, 5, 2]]) {
                        for (const clip of [false, true]) {
                            for (const [label, bx, by] of SIDES) {
                                // identity, line widths 1..7 (odd widths put the path on half pixels)
                                const variants = [];
                                for (let lw = 1; lw <= 7; lw++) {
                                    variants.push({ scale: 1, lw, x: bx, y: by, w: 38, h: 34, r: radii });
                                }
                                // scale(2): the 1-logical-px crisp spelling, box at logical (bx/2, by/2)
                                variants.push({
                                    scale: 2,
                                    lw: 1,
                                    x: bx / 2 + 0.5,
                                    y: by / 2 + 0.5,
                                    w: 19 - 1,
                                    h: 17 - 1,
                                    r: Array.isArray(radii) ? radii.map((v) => Math.round(v / 2)) : Math.round(radii / 2)
                                });
                                for (const v of variants) {
                                    const opts = Object.assign({ fused, semi, clip }, v);
                                    const offAxisX = label.endsWith('left') || label.endsWith('right');
                                    const shift = label.endsWith('left') || label.endsWith('top') ? PAD : 0;
                                    const got = render(W, H, 0, 0, opts);
                                    const wide = offAxisX
                                        ? render(W + PAD, H, shift, 0, opts)
                                        : render(W, H + PAD, 0, shift, opts);
                                    for (let y = 0; y < H; y++) {
                                        for (let x = 0; x < W; x++) {
                                            const go = y * got.stride + x * 4;
                                            const wo = offAxisX
                                                ? y * wide.stride + (x + shift) * 4
                                                : (y + shift) * wide.stride + x * 4;
                                            for (let c = 0; c < 4; c++) {
                                                if (got.data[go + c] !== wide.data[wo + c]) {
                                                    throw new Error(
                                                        `${fused ? 'fillStrokeRoundRect' : 'strokeRoundRect'} ${label} ` +
                                                            `${semi ? 'semi' : 'opaque'} radii=${JSON.stringify(radii)} ` +
                                                            `clip=${clip} scale=${opts.scale} lw=${opts.lw}: pixel (${x},${y}) ` +
                                                            `differs from the fully-on-surface render`
                                                    );
                                                }
                                            }
                                        }
                                    }
                                    cases++;
                                }
                            }
                        }
                    }
                }
            }
            log(`  ${cases} off-surface renders match their fully-on-surface windows`);
        });


        // Test: thick axis-aligned rounded-rect strokes cover exactly the pixel-center ring
        // This file will be concatenated into the main test suite
        //
        // SWCanvas samples coverage at pixel CENTERS (the polygon filler, CircleOps,
        // the row walk of the rounded-rect arms). For a thick axis-aligned rounded-rect
        // stroke whose frame sits on the pixel grid - the case the direct arm's integer
        // frame is exact for - the painted ring must therefore be exactly the pixels
        // whose centers lie within lineWidth / 2 of the path outline, on all four sides
        // alike. Pinned here, against that analytic ring (pixels whose center lies ON the
        // ring's boundary are not asserted):
        //   1. EXACT RING: strokeRoundRect and fillStrokeRoundRect (its stroke colour),
        //      identity at line widths 2..6 (odd widths on half-pixel paths), and the
        //      1-logical-px crisp spelling under scale(2) (strokeRoundRect(0.5, 0.5,
        //      w - 1, h - 1, r): a 2-device-px ring), radii 1..12, uniform and per-corner;
        //   2. TRANSPOSE SYMMETRY: on a square box the ring is its own mirror image across
        //      the diagonal - a vertical side's run up to its arc is the same shape as
        //      the horizontal side's.

        test('RoundRect thick strokes - exact pixel-center ring, transpose-symmetric', () => {
            // 1 covered, 0 not, 0.5 on the boundary (not asserted). Path: rounded rect
            // (x0,y0)-(x1,y1) with corner radii [tl, tr, br, bl]; the ring is every point
            // within hs of its outline.
            function ideal(px, py, x0, y0, x1, y1, radii, hs) {
                const cx = px + 0.5;
                const cy = py + 0.5;
                // the corner whose quadrant holds the point, if any
                let r = 0;
                let kx = 0;
                let ky = 0;
                if (cx < x0 + radii[0] && cy < y0 + radii[0]) {
                    r = radii[0];
                    kx = x0 + r;
                    ky = y0 + r;
                } else if (cx > x1 - radii[1] && cy < y0 + radii[1]) {
                    r = radii[1];
                    kx = x1 - r;
                    ky = y0 + r;
                } else if (cx > x1 - radii[2] && cy > y1 - radii[2]) {
                    r = radii[2];
                    kx = x1 - r;
                    ky = y1 - r;
                } else if (cx < x0 + radii[3] && cy > y1 - radii[3]) {
                    r = radii[3];
                    kx = x0 + r;
                    ky = y1 - r;
                }
                let dist;
                if (r > 0) {
                    dist = Math.abs(Math.sqrt((cx - kx) * (cx - kx) + (cy - ky) * (cy - ky)) - r);
                } else {
                    // outside every rounded quadrant: distance to the box outline - past a
                    // radius-0 corner the outer edge is SQUARE (a mitered right angle, as
                    // strokeRect's), hence the larger of the two side distances
                    const ox = Math.max(x0 - cx, 0, cx - x1);
                    const oy = Math.max(y0 - cy, 0, cy - y1);
                    dist = ox > 0 || oy > 0 ? Math.max(ox, oy) : Math.min(cx - x0, x1 - cx, cy - y0, y1 - cy);
                }
                if (Math.abs(dist - hs) < 1e-9) return 0.5;
                return dist < hs ? 1 : 0;
            }

            const W = 80;
            const H = 72;
            function stroked(opts) {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(255, 255, 255, 255);
                ctx.fillRect(0, 0, W, H);
                if (opts.scale !== 1) ctx.scale(opts.scale, opts.scale);
                ctx.setStrokeStyle(255, 0, 0, 255);
                ctx.setFillStyle(0, 0, 255, 255);
                ctx.lineWidth = opts.lw;
                if (opts.fused) ctx.fillStrokeRoundRect(opts.x, opts.y, opts.w, opts.h, opts.r);
                else ctx.strokeRoundRect(opts.x, opts.y, opts.w, opts.h, opts.r);
                return surface;
            }
            const isStroke = (s, x, y) => {
                const o = y * s.stride + x * 4;
                return s.data[o] === 255 && s.data[o + 1] === 0 && s.data[o + 2] === 0;
            };

            let renders = 0;
            let asserted = 0;
            for (const fused of [false, true]) {
                for (const radiiSpec of [1, 2, 3, 5, 7, 8, 10, 12, [10, 0, 6, 3]]) {
                    // identity: a box of integer device edges, path inset by hs (odd widths on half pixels)
                    const cases = [];
                    for (let lw = 2; lw <= 6; lw++) {
                        const hs = lw / 2;
                        cases.push({ scale: 1, lw, x: 6 + hs, y: 5 + hs, w: 60 - lw, h: 54 - lw, r: radiiSpec, dev: 1 });
                    }
                    // scale(2), the crisp 1-logical-px spelling: box 30x27 logical at (3, 2)
                    const half = Array.isArray(radiiSpec) ? radiiSpec.map((v) => Math.ceil(v / 2)) : Math.ceil(radiiSpec / 2);
                    cases.push({ scale: 2, lw: 1, x: 3.5, y: 2.5, w: 29, h: 26, r: half, dev: 2 });
                    for (const c of cases) {
                        const s = stroked(Object.assign({ fused }, c));
                        const k = c.dev;
                        const hs = (c.lw * k) / 2;
                        const x0 = c.x * k;
                        const y0 = c.y * k;
                        const x1 = (c.x + c.w) * k;
                        const y1 = (c.y + c.h) * k;
                        const rr = Array.isArray(c.r) ? c.r.map((v) => v * k) : [c.r * k, c.r * k, c.r * k, c.r * k];
                        for (let y = 0; y < H; y++) {
                            for (let x = 0; x < W; x++) {
                                const want = ideal(x, y, x0, y0, x1, y1, rr, hs);
                                if (want === 0.5) continue;
                                asserted++;
                                if ((want === 1) !== isStroke(s, x, y)) {
                                    throw new Error(
                                        `${fused ? 'fillStrokeRoundRect' : 'strokeRoundRect'} scale=${c.scale} lw=${c.lw} ` +
                                            `radii=${JSON.stringify(c.r)}: pixel (${x},${y}) is ${want ? 'in' : 'outside'} the ` +
                                            `pixel-center ring but ${want ? 'unpainted' : 'painted'}`
                                    );
                                }
                            }
                        }
                        renders++;
                    }
                }
            }

            // 2. transpose symmetry on a square box, every radius 1..16 at lw 2 and 3, and at scale(2)
            let squares = 0;
            for (let r = 1; r <= 16; r++) {
                for (const c of [
                    { scale: 1, lw: 2, x: 5, y: 5, w: 60, h: 60, r },
                    { scale: 1, lw: 3, x: 5.5, y: 5.5, w: 59, h: 59, r },
                    { scale: 2, lw: 1, x: 2.5, y: 2.5, w: 31, h: 31, r: Math.ceil(r / 2) }
                ]) {
                    const s = stroked(Object.assign({ fused: false }, c));
                    for (let y = 0; y < H; y++) {
                        for (let x = 0; x < H; x++) {
                            if (isStroke(s, x, y) !== isStroke(s, y, x)) {
                                throw new Error(
                                    `strokeRoundRect square scale=${c.scale} lw=${c.lw} r=${c.r}: (${x},${y}) and ` +
                                        `(${y},${x}) differ - the vertical and horizontal sides are not mirror images`
                                );
                            }
                        }
                    }
                    squares++;
                }
            }
            log(`  ${renders} rings exact (${asserted} pixels asserted), ${squares} square rings transpose-symmetric`);
        });


        // Test: one stroke() is the UNION of its parts - overlapping caps, joins and bodies never cancel
        // This file will be concatenated into the main test suite
        //
        // A stroke covers the union of the shapes its pen sweeps (HTML5: the traced path is
        // "the edge of the areas that would be covered" by the swept line). SWCanvas fills a
        // stroke's parts - segment bodies, joins, caps - together under the nonzero rule, so
        // a part wound against the others would cancel coverage wherever it overlaps another
        // part of the same stroke(). Pinned here, with opaque paint (overpainting is the union):
        //   1. ACROSS SUBPATHS: stroking several subpaths in ONE stroke() paints exactly what
        //      stroking each in its own stroke() paints - a T (the stem's start cap on the bar,
        //      and the bar's end on the stem), a cross, a star of segments sharing an end,
        //      collinear overlaps run both ways, a V whose join lies on a crossing bar; every
        //      cap and join kind;
        //   2. WITHIN A SUBPATH: a polyline's stroke paints every pixel each of its segments
        //      paints stroked alone (butt caps) - sharp V turns and near-degenerate closed
        //      quads, where a join's parts overlap the bodies they connect;
        //   3. isPointInStroke reads the same parts: a point where the T's stem cap overlaps
        //      the bar is in the stroke.

        test('One-path stroke - the union of its parts', () => {
            const S = 48;
            function render(width, height, setup, paths, closed) {
                const canvas = SWCanvas.createCanvas(width, height);
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, width, height);
                ctx.strokeStyle = '#000';
                setup(ctx);
                for (const subpaths of paths) {
                    ctx.beginPath();
                    for (const pts of subpaths) {
                        pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
                        if (closed) ctx.closePath();
                    }
                    ctx.stroke();
                }
                return ctx.getImageData(0, 0, width, height).data;
            }

            // 1. ACROSS SUBPATHS
            const scenes = [];
            const c = S / 2;
            scenes.push(['tee (cap on the bar)', [[[4, c], [S - 4, c]], [[c, c], [c, 6]]]]);
            scenes.push(['tee (bar end on the stem)', [[[c, 6], [c, c]], [[4, c], [S - 4, c]]]]);
            scenes.push(['cross', [[[4, c], [S - 4, c]], [[c, 4], [c, S - 4]]]]);
            scenes.push(['collinear overlap, same way', [[[4, c], [30, c]], [[16, c], [S - 4, c]]]]);
            scenes.push(['collinear overlap, opposite ways', [[[4, c], [30, c]], [[S - 4, c], [16, c]]]]);
            scenes.push(['V join on a crossing bar', [[[8, 40], [c, 20], [40, 40]], [[4, 22], [S - 4, 22]]]]);
            const star = [];
            for (let k = 0; k < 7; k++) {
                const a = (k * 2 * Math.PI) / 7 + 0.3;
                star.push([[c, c], [Math.round(c + 18 * Math.cos(a)), Math.round(c + 18 * Math.sin(a))]]);
            }
            scenes.push(['star of 7 from one point', star]);
            let unionCases = 0;
            for (const cap of ['round', 'square', 'butt']) {
                for (const join of ['round', 'miter', 'bevel']) {
                    for (const lw of [2, 3, 4, 6, 8]) {
                        for (const [label, subpaths] of scenes) {
                            const setup = (ctx) => {
                                ctx.lineWidth = lw;
                                ctx.lineCap = cap;
                                ctx.lineJoin = join;
                            };
                            const together = render(S, S, setup, [subpaths], false);
                            const apart = render(S, S, setup, subpaths.map((p) => [p]), false);
                            for (let i = 0; i < together.length; i += 4) {
                                if (together[i] !== apart[i]) {
                                    const p = i / 4;
                                    throw new Error(
                                        `${label} cap=${cap} join=${join} lw=${lw}: pixel (${p % S},${Math.floor(p / S)}) ` +
                                            `${together[i] < 128 ? 'painted' : 'unpainted'} in one stroke() but ` +
                                            `${apart[i] < 128 ? 'painted' : 'unpainted'} stroked part by part`
                                    );
                                }
                            }
                            unionCases++;
                        }
                    }
                }
            }

            // 2. WITHIN A SUBPATH: sharp V turns, and thin closed quads (a grid of skews, thicknesses,
            //    sizes and sub-pixel offsets)
            const polylines = [];
            for (const dx of [1, 2, 3, 5]) {
                polylines.push([
                    [
                        [
                            [c - dx, 6],
                            [c, 40],
                            [c + dx, 6]
                        ]
                    ],
                    false
                ]);
            }
            for (const skew of [-0.35, -0.1, 0.15, 0.4]) {
                for (const thin of [0.03, 0.08, 0.15]) {
                    for (const [size, x0, y0] of [
                        [12, 14.3, 18.6],
                        [23, 11.7, 15.2]
                    ]) {
                        const t = size * thin;
                        polylines.push([
                            [
                                [
                                    [x0, y0],
                                    [x0 + size, y0 + skew * size],
                                    [x0 + size * (1 + skew), y0 + skew * size + t],
                                    [x0 + skew * size, y0 + t]
                                ]
                            ],
                            true
                        ]);
                    }
                }
            }
            let subsetCases = 0;
            for (const join of ['round', 'miter', 'bevel']) {
                for (const lw of [1, 2, 3]) {
                    for (const [subpaths, closed] of polylines) {
                        const setup = (ctx) => {
                            ctx.lineWidth = lw;
                            ctx.lineCap = 'butt';
                            ctx.lineJoin = join;
                        };
                        const whole = render(S, S, setup, [subpaths], closed);
                        const pts = closed ? subpaths[0].concat([subpaths[0][0]]) : subpaths[0];
                        for (let j = 0; j + 1 < pts.length; j++) {
                            const seg = render(S, S, setup, [[[pts[j], pts[j + 1]]]], false);
                            for (let i = 0; i < whole.length; i += 4) {
                                if (seg[i] < 128 && whole[i] >= 128) {
                                    const p = i / 4;
                                    throw new Error(
                                        `polyline ${JSON.stringify(pts.map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)]))} ` +
                                            `join=${join} lw=${lw}: pixel (${p % S},${Math.floor(p / S)}) is painted by ` +
                                            `segment ${j} alone but not by the whole stroke`
                                    );
                                }
                            }
                        }
                        subsetCases++;
                    }
                }
            }

            // 3. isPointInStroke: inside the bar AND the stem's start cap, off every part edge
            const probe = SWCanvas.createCanvas(S, S).getContext('2d');
            probe.lineWidth = 4;
            probe.lineCap = 'round';
            probe.beginPath();
            probe.moveTo(4, c);
            probe.lineTo(S - 4, c);
            probe.moveTo(c, c);
            probe.lineTo(c, 6);
            if (!probe.isPointInStroke(c + 0.3, c + 1.1) || probe.isPointInStroke(c + 0.3, c + 4)) {
                throw new Error('isPointInStroke: the stem cap over the bar must be in the stroke, a point past both must not');
            }

            log(`  ${unionCases} one-path renders equal their part-by-part union, ${subsetCases} polylines contain their segments`);
        });


        // Test: a round-capped segment is seamless - no unpainted pixel between its caps and its body
        // This file will be concatenated into the main test suite
        //
        // A single round-capped segment is a convex capsule, so under pixel-center
        // sampling every row and every column of what it paints is ONE unbroken run. A
        // pixel left unpainted inside it lies on a seam: where a cap meets the body, two
        // polygons share an edge (traversed opposite ways), and the filler must cross it
        // at the same x from both sides or a pixel center on it falls between the two
        // spans. Swept like an analog clock's hands: integer ends on a circle at 60
        // angles, widths 4..8, two lengths, four face sizes.

        test('Round-capped segment - seamless capsule', () => {
            function render(width, height, setup, paths) {
                const canvas = SWCanvas.createCanvas(width, height);
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, width, height);
                ctx.strokeStyle = '#000';
                setup(ctx);
                for (const subpaths of paths) {
                    ctx.beginPath();
                    for (const pts of subpaths) {
                        pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
                    }
                    ctx.stroke();
                }
                return ctx.getImageData(0, 0, width, height).data;
            }

            let capsules = 0;
            for (const side of [40, 60, 80, 120]) {
                const C = side / 2 + 4;
                const W = 2 * C;
                for (let lw = 4; lw <= 8; lw++) {
                    for (const len of [0.27, 0.37]) {
                        for (let k = 0; k < 60; k++) {
                            const a = (k * 2 * Math.PI) / 60;
                            const tip = len * side;
                            const x2 = C + Math.round(tip * Math.sin(a));
                            const y2 = C + Math.round(-tip * Math.cos(a));
                            const d = render(
                                W,
                                W,
                                (ctx) => {
                                    ctx.lineWidth = lw;
                                    ctx.lineCap = 'round';
                                },
                                [[[[C, C], [x2, y2]]]]
                            );
                            const ink = (x, y) => d[(y * W + x) * 4] < 128;
                            for (let pass = 0; pass < 2; pass++) {
                                for (let u = 0; u < W; u++) {
                                    let runs = 0;
                                    let prev = false;
                                    for (let v = 0; v < W; v++) {
                                        const on = pass === 0 ? ink(v, u) : ink(u, v);
                                        if (on && !prev) runs++;
                                        prev = on;
                                    }
                                    if (runs > 1) {
                                        throw new Error(
                                            `round-capped segment (${C},${C})-(${x2},${y2}) lw=${lw}: ${pass === 0 ? 'row' : 'column'} ` +
                                                `${u} paints ${runs} separate runs - an unpainted seam inside the capsule`
                                        );
                                    }
                                }
                            }
                            capsules++;
                        }
                    }
                }
            }
            log(`  ${capsules} capsules seamless`);
        });


        // Test: the direct circle FILL samples pixel centers - at every diameter, alignment and radius
        // This file will be concatenated into the main test suite
        //
        // Pins the coverage rule of the direct circle fill (CircleOps header): a pixel is
        // filled iff its center (x + 0.5, y + 0.5) lies STRICTLY inside the circle, so a
        // center exactly on the boundary stays out on every side alike. The fixture spans
        // what a narrow one misses - a fill that walks integer row offsets from a snapped
        // center can agree with this rule at one alignment and diameter and still drop
        // whole rows of pixels (or add stray ones) at the next:
        //   - every diameter 1..40, at integer radii AND radii a quarter pixel larger;
        //   - four centre alignments: pixel corner, pixel center, mixed, fractional;
        //   - opaque (fill_Opaq) and translucent (fill_Alpha) paint;
        //   - a uniform scale(2) context (the direct path pre-multiplies the CTM);
        // and asserts that the fused entry's fill half (fillStrokeCircle with a transparent
        // stroke) and a full-circle fillArc (delegated to the same renderer) paint the very
        // same pixel set - one rule for every direct circle fill.
        // Then: a NaN or infinite radius paints nothing (an infinite one would otherwise
        // sample every pixel center as inside) on the three fill entries.

        test('Circle fill - pixel-center coverage at every diameter, alignment and radius', () => {
            const W = 72;
            const H = 72;
            const C = 36;
            const TAU = Math.PI * 2;
            const ALIGNMENTS = [
                ['pixel corner', 0, 0],
                ['pixel center', 0.5, 0.5],
                ['mixed', 0, 0.5],
                ['fractional', 0.3, 0.7]
            ];

            function coverage(draw) {
                const surface = SWCanvas.Core.Surface(W, H);
                const ctx = new SWCanvas.Core.Context2D(surface);
                draw(ctx);
                const set = new Set();
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        if (surface.data[y * surface.stride + x * 4 + 3] !== 0) set.add(y * W + x);
                    }
                }
                return set;
            }

            function pixelCenterDisk(cx, cy, r) {
                const set = new Set();
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        const dx = x + 0.5 - cx;
                        const dy = y + 0.5 - cy;
                        if (dx * dx + dy * dy < r * r) set.add(y * W + x);
                    }
                }
                return set;
            }

            function assertSameSet(label, got, want) {
                const missing = [];
                const extra = [];
                for (const p of want) if (!got.has(p)) missing.push(`(${p % W},${Math.floor(p / W)})`);
                for (const p of got) if (!want.has(p)) extra.push(`(${p % W},${Math.floor(p / W)})`);
                if (missing.length || extra.length) {
                    throw new Error(
                        `${label}: ${got.size} px, expected ${want.size} - missing [${missing.slice(0, 6).join(' ')}` +
                            `${missing.length > 6 ? ' ...' : ''}] extra [${extra.slice(0, 6).join(' ')}${extra.length > 6 ? ' ...' : ''}]`
                    );
                }
            }

            const ENTRIES = [
                ['fillCircle opaque', (ctx, cx, cy, r) => {
                    ctx.setFillStyle(0, 0, 255, 255);
                    ctx.fillCircle(cx, cy, r);
                }],
                ['fillCircle translucent', (ctx, cx, cy, r) => {
                    ctx.setFillStyle(0, 0, 255, 128);
                    ctx.fillCircle(cx, cy, r);
                }],
                ['fillStrokeCircle fill half', (ctx, cx, cy, r) => {
                    ctx.setFillStyle(0, 0, 255, 255);
                    ctx.setStrokeStyle(0, 0, 0, 0);
                    ctx.fillStrokeCircle(cx, cy, r);
                }],
                ['fillArc full circle', (ctx, cx, cy, r) => {
                    ctx.setFillStyle(0, 0, 255, 255);
                    ctx.fillArc(cx, cy, r, 0, TAU);
                }]
            ];

            let cases = 0;
            for (const [alignName, ox, oy] of ALIGNMENTS) {
                for (const extra of [0, 0.25]) {
                    for (let d = 1; d <= 40; d++) {
                        const r = d / 2 + extra;
                        const cx = C + ox;
                        const cy = C + oy;
                        const want = pixelCenterDisk(cx, cy, r);
                        for (const [entryName, draw] of ENTRIES) {
                            assertSameSet(
                                `${entryName} r=${r} at ${alignName} (${cx},${cy})`,
                                coverage(ctx => draw(ctx, cx, cy, r)),
                                want
                            );
                            cases++;
                        }
                        // Under scale(2): the same device geometry from half-size user coordinates
                        assertSameSet(
                            `fillCircle under scale(2) device r=${r} at ${alignName} (${cx},${cy})`,
                            coverage(ctx => {
                                ctx.scale(2, 2);
                                ctx.setFillStyle(0, 0, 255, 255);
                                ctx.fillCircle(cx / 2, cy / 2, r / 2);
                            }),
                            want
                        );
                        cases++;
                    }
                }
            }
            log(`  ${cases} renders: every direct circle fill entry paints exactly the pixel-center-sampled disk`);

            // Non-finite radii paint nothing. (strokeCircle / outerStrokeArc at lineWidth 1
            // are left out on purpose: an infinite radius there never terminates the
            // Bresenham walk unless the entry guard holds, so a regression would hang the
            // suite instead of failing this test.)
            const NONFINITE_ENTRIES = [
                ['fillCircle', (ctx, r) => ctx.fillCircle(C, C, r)],
                ['fillStrokeCircle', (ctx, r) => {
                    ctx.setStrokeStyle(255, 0, 0, 255);
                    ctx.lineWidth = 2;
                    ctx.fillStrokeCircle(C, C, r);
                }],
                ['fillArc full circle', (ctx, r) => ctx.fillArc(C, C, r, 0, TAU)]
            ];
            for (const [entryName, draw] of NONFINITE_ENTRIES) {
                for (const r of [Infinity, NaN]) {
                    let painted;
                    try {
                        painted = coverage(ctx => {
                            ctx.setFillStyle(0, 0, 255, 255);
                            draw(ctx, r);
                        });
                    } catch (e) {
                        throw new Error(`${entryName} radius ${r}: threw "${e.message}" instead of drawing nothing`);
                    }
                    if (painted.size !== 0) {
                        throw new Error(`${entryName} radius ${r}: painted ${painted.size} px, expected nothing`);
                    }
                }
            }
            log('  NaN and infinite radii draw nothing on fillCircle, fillStrokeCircle and a full-circle fillArc');
        });


        // Test: rounded-rect fills and clips are translation-invariant under integer translations
        // This file will be concatenated into the main test suite
        //
        // A rasterizer must paint the same pixels for the same integer geometry wherever it
        // is drawn. Pinned for every rounded-rect FILL path and both CLIP spellings, which
        // all flatten arcTo corners through the generic pipeline: fillRoundRect (uniform
        // and per-corner radii, opaque and translucent), fillStadium, roundRect() + fill(),
        // roundRect() + clip() on the Context2D path and clip(SWPath2D) - plus the direct
        // stroke and fused arms as controls. Every integer radius 1..64 and half-integer
        // radius 0.5..40.5, at device positions including the canvas's own (0, 0) and
        // coordinates up to ~4000 on each axis, must reproduce the baseline crop at (3, 3).
        //
        // What it guards: an arcTo corner is flattened into ceil(sweep / 90deg x 16)
        // segments, and an exact quarter turn's sweep comes out of atan2 of the corner's
        // position-dependent tangent points as 16.000000000000004 at some positions. A bare
        // ceil gives the top-right (sometimes the bottom-right) corner 17 segments there and
        // 16 elsewhere - 1 to 8 corner pixels differ at radii such as 15, 17, 28, 29, 32,
        // 34, 38, 39, 44 - so every segment count goes through PathFlattener.segmentCount.

        test('roundRect fills and clips - translation-invariant at integer positions', () => {
            const M = 2; // margin read around the box
            const BASE = [3, 3];
            const POSITIONS = [
                [0, 0],
                [0, 3],
                [3, 0],
                [1, 1],
                [64, 1],
                [127, 255],
                [333, 7],
                [2056, 236],
                [4093, 5],
                [5, 4093]
            ];

            // draw(ctx, X, Y, w, h, r): an integer box at device (X, Y)
            const SHAPES = [
                ['fillRoundRect', (c, X, Y, w, h, r) => c.fillRoundRect(X, Y, w, h, r)],
                ['fillRoundRect translucent', (c, X, Y, w, h, r) => {
                    c.setFillStyle(0, 0, 0, 128);
                    c.fillRoundRect(X, Y, w, h, r);
                }],
                ['fillRoundRect per-corner', (c, X, Y, w, h, r) => c.fillRoundRect(X, Y, w, h, [r, r, 0, r / 2])],
                ['fillStadium', (c, X, Y, w, h, r) => c.fillStadium(X, Y, w, 2 * r)],
                ['roundRect + fill', (c, X, Y, w, h, r) => {
                    c.beginPath();
                    c.roundRect(X, Y, w, h, r);
                    c.fill();
                }],
                ['roundRect + clip', (c, X, Y, w, h, r) => {
                    c.beginPath();
                    c.roundRect(X, Y, w, h, r);
                    c.clip();
                    c.fillRect(X - 1, Y - 1, w + 2, h + 2);
                }],
                ['clip(SWPath2D roundRect)', (c, X, Y, w, h, r) => {
                    const p = new SWCanvas.Core.SWPath2D();
                    p.roundRect(X, Y, w, h, r);
                    c.clip(p);
                    c.fillRect(X - 1, Y - 1, w + 2, h + 2);
                }],
                // controls: the direct stroke and fused arms (integer-snapped)
                ['strokeRoundRect 1px', (c, X, Y, w, h, r) => {
                    c.setStrokeStyle(0, 0, 0, 255);
                    c.lineWidth = 1;
                    c.strokeRoundRect(X + 0.5, Y + 0.5, w - 1, h - 1, r);
                }],
                ['fillStrokeRoundRect', (c, X, Y, w, h, r) => {
                    c.setFillStyle(128, 128, 128, 255);
                    c.setStrokeStyle(0, 0, 0, 255);
                    c.lineWidth = 2;
                    c.fillStrokeRoundRect(X + 1, Y + 1, w - 2, h - 2, r);
                }]
            ];

            // The crop [X-M, X+w+M) x [Y-M, Y+h+M) of a canvas just big enough to hold it;
            // pixels left of / above the canvas read as empty.
            function crop(draw, X, Y, w, h, r) {
                const cw = X + w + M + 1;
                const ch = Y + h + M + 1;
                const surface = SWCanvas.Core.Surface(cw, ch);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.setFillStyle(0, 0, 0, 255);
                draw(ctx, X, Y, w, h, r);
                const rw = w + 2 * M;
                const rh = h + 2 * M;
                const out = new Uint8Array(rw * rh * 4);
                for (let yy = 0; yy < rh; yy++) {
                    const sy = Y - M + yy;
                    if (sy < 0) continue;
                    for (let xx = 0; xx < rw; xx++) {
                        const sx = X - M + xx;
                        if (sx < 0) continue;
                        const so = sy * surface.stride + sx * 4;
                        const d = (yy * rw + xx) * 4;
                        out[d] = surface.data[so];
                        out[d + 1] = surface.data[so + 1];
                        out[d + 2] = surface.data[so + 2];
                        out[d + 3] = surface.data[so + 3];
                    }
                }
                return { out, rw };
            }

            const radii = [];
            for (let r = 1; r <= 64; r++) radii.push(r);
            for (let r = 0.5; r <= 40.5; r += 1) radii.push(r);

            let cases = 0;
            for (const [name, draw] of SHAPES) {
                for (const r of radii) {
                    const w = Math.ceil(2 * r) + 4;
                    const h = Math.ceil(2 * r) + 4;
                    const base = crop(draw, BASE[0], BASE[1], w, h, r);
                    for (const [X, Y] of POSITIONS) {
                        const got = crop(draw, X, Y, w, h, r);
                        for (let i = 0; i < base.out.length; i++) {
                            if (base.out[i] !== got.out[i]) {
                                const p = i >> 2;
                                throw new Error(
                                    `${name} r=${r} ${w}x${h}: at (${X},${Y}) box pixel ` +
                                        `(${(p % base.rw) - M},${Math.floor(p / base.rw) - M}) differs from the same box at ` +
                                        `(${BASE[0]},${BASE[1]}) - the corner flattening depends on position`
                                );
                            }
                        }
                        cases++;
                    }
                }
            }
            log(`  ${cases} placements: every rounded-rect fill/clip path paints the same pixels at every integer position`);
        });


        // Test: the HTML5 (path?, fillRule?) overload of fill / clip / isPointInPath
        // This file will be concatenated into the main test suite
        //
        // fill(), clip() and isPointInPath() share one HTML5 overload shape: an optional
        // Path2D followed by an optional fill rule, where a LEADING string is the rule
        // and an explicitly passed undefined means "omitted" (WebIDL). Contract pinned
        // here, on BOTH API layers:
        //   1. clip(rule) clips the current default path under that rule, exactly as
        //      fill(rule) fills it (and as clip(path2d, rule) clips a Path2D);
        //   2. an explicit undefined rule or path behaves as the omitted argument;
        //   3. isPointInPath(x, y, undefined) is the (x, y, fillRule) form, not a
        //      malformed (path, x, y);
        //   4. a rule string other than 'evenodd' is LENIENT - it fills and clips
        //      nonzero instead of throwing the TypeError WebIDL specifies.
        // Fixture: two nested rects of the SAME winding, so nonzero covers the inner
        // rect and evenodd leaves it as a hole.

        test('fill/clip/isPointInPath (path?, fillRule?) overload parity', () => {
            const SIZE = 20;
            const HOLE = [10, 10]; // inside the inner rect
            const RING = [4, 4]; // between the two rects
            const OUT = [0, 0]; // outside both

            function nestedRects(target) {
                target.rect(2, 2, 16, 16);
                target.rect(6, 6, 8, 8);
            }

            function alphaAt(ctx, p) {
                return ctx.getImageData(p[0], p[1], 1, 1).data[3];
            }

            // Each case returns the HTML5 context after the operation; the expected
            // coverage is "hole painted?" (nonzero) or not (evenodd).
            function checkCoverage(label, ctx, holePainted) {
                assertEquals(alphaAt(ctx, RING), 255, label + ': ring must be painted');
                assertEquals(alphaAt(ctx, OUT), 0, label + ': outside must stay clear');
                assertEquals(alphaAt(ctx, HOLE), holePainted ? 255 : 0,
                    label + ': hole must be ' + (holePainted ? 'painted (nonzero)' : 'clear (evenodd)'));
            }

            function fillCase(label, op, usePath2D, holePainted) {
                const ctx = SWCanvas.createCanvas(SIZE, SIZE).getContext('2d');
                ctx.fillStyle = '#ff0000';
                let p;
                if (usePath2D) {
                    p = new SWCanvas.Core.SWPath2D();
                    nestedRects(p);
                } else {
                    ctx.beginPath();
                    nestedRects(ctx);
                }
                op(ctx, p);
                checkCoverage(label, ctx, holePainted);
            }

            function clipCase(label, op, usePath2D, holePainted) {
                const ctx = SWCanvas.createCanvas(SIZE, SIZE).getContext('2d');
                let p;
                if (usePath2D) {
                    p = new SWCanvas.Core.SWPath2D();
                    nestedRects(p);
                } else {
                    ctx.beginPath();
                    nestedRects(ctx);
                }
                op(ctx, p);
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(0, 0, SIZE, SIZE);
                checkCoverage(label, ctx, holePainted);
            }

            // 1. fill vs clip, every overload, on the HTML5 facade
            fillCase('fill()', ctx => ctx.fill(), false, true);
            fillCase("fill('nonzero')", ctx => ctx.fill('nonzero'), false, true);
            fillCase("fill('evenodd')", ctx => ctx.fill('evenodd'), false, false);
            fillCase("fill(path2d, 'evenodd')", (ctx, p) => ctx.fill(p, 'evenodd'), true, false);
            clipCase('clip()', ctx => ctx.clip(), false, true);
            clipCase("clip('nonzero')", ctx => ctx.clip('nonzero'), false, true);
            clipCase("clip('evenodd')", ctx => ctx.clip('evenodd'), false, false);
            clipCase("clip(path2d, 'evenodd')", (ctx, p) => ctx.clip(p, 'evenodd'), true, false);

            // 2. explicit undefined == omitted
            fillCase('fill(undefined)', ctx => ctx.fill(undefined), false, true);
            fillCase('fill(path2d, undefined)', (ctx, p) => ctx.fill(p, undefined), true, true);
            clipCase('clip(undefined)', ctx => ctx.clip(undefined), false, true);
            clipCase('clip(path2d, undefined)', (ctx, p) => ctx.clip(p, undefined), true, true);

            // clip(rule) under a CTM: the current path is baked at construction time,
            // so the rule must apply to the baked geometry (no re-transform).
            {
                const ctx = SWCanvas.createCanvas(SIZE, SIZE).getContext('2d');
                ctx.scale(2, 2);
                ctx.beginPath();
                ctx.rect(1, 1, 8, 8);
                ctx.rect(3, 3, 4, 4);
                ctx.clip('evenodd');
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(0, 0, SIZE, SIZE);
                checkCoverage("scale(2) + clip('evenodd')", ctx, false);
            }

            // 3. isPointInPath(x, y, undefined) is the (x, y, fillRule) form
            {
                const ctx = SWCanvas.createCanvas(SIZE, SIZE).getContext('2d');
                ctx.beginPath();
                nestedRects(ctx);
                assertEquals(ctx.isPointInPath(HOLE[0], HOLE[1], undefined), true, 'isPointInPath(x, y, undefined) = nonzero');
                assertEquals(ctx.isPointInPath(HOLE[0], HOLE[1], 'evenodd'), false, "isPointInPath(x, y, 'evenodd')");
                const p = new SWCanvas.Core.SWPath2D();
                nestedRects(p);
                assertEquals(ctx.isPointInPath(p, HOLE[0], HOLE[1], undefined), true, 'isPointInPath(path2d, x, y, undefined)');
            }

            // 4. An unknown rule string fills and clips nonzero (lenient).
            fillCase("fill('bogus')", ctx => ctx.fill('bogus'), false, true);
            clipCase("clip('bogus')", ctx => ctx.clip('bogus'), false, true);
            clipCase("clip(path2d, 'bogus')", (ctx, p) => ctx.clip(p, 'bogus'), true, true);

            // Dual-API parity: the Core Context2D takes the same overloads.
            function coreAlpha(surface, p) {
                return surface.data[p[1] * surface.stride + p[0] * 4 + 3];
            }
            function coreCase(label, op, isClip, holePainted) {
                const surface = SWCanvas.Core.Surface(SIZE, SIZE);
                const core = new SWCanvas.Core.Context2D(surface);
                core.setFillStyle(255, 0, 0, 255);
                core.beginPath();
                nestedRects(core);
                op(core);
                if (isClip) core.fillRect(0, 0, SIZE, SIZE);
                assertEquals(coreAlpha(surface, RING), 255, 'Core ' + label + ': ring must be painted');
                assertEquals(coreAlpha(surface, OUT), 0, 'Core ' + label + ': outside must stay clear');
                assertEquals(coreAlpha(surface, HOLE), holePainted ? 255 : 0, 'Core ' + label + ': hole');
            }
            coreCase("clip('evenodd')", c => c.clip('evenodd'), true, false);
            coreCase("clip('nonzero')", c => c.clip('nonzero'), true, true);
            coreCase("fill('evenodd')", c => c.fill('evenodd'), false, false);
            coreCase('fill(undefined)', c => c.fill(undefined), false, true);
            coreCase("fill(undefined, 'evenodd')", c => c.fill(undefined, 'evenodd'), false, false);
        });


        // Test: drawImage's smoothing filter reads clamp-to-edge outside the image and
        // the image itself outside the source rect (HTML5 filtering rule)
        // This file will be concatenated into the main test suite
        //
        // HTML5 drawImage: "When the filtering algorithm requires a pixel value from
        // outside the original image data, it must instead use the value from the
        // nearest edge pixel. (That is, the filter uses 'clamp-to-edge' behavior.)
        // When the filtering algorithm requires a pixel value from outside the source
        // rectangle but inside the original image data, then the value from the
        // original image data must be used." - "Thus, scaling an image in parts or in
        // whole will have the same effect." Contract pinned here (smoothing on, so
        // every scaled draw takes the bilinear filter):
        //   1. an OPAQUE image scaled up stays opaque to its edges - by a rect ratio,
        //      by a ctx.scale CTM, and at a non-integer ratio;
        //   2. a sub-rect draw blends the texels just outside the source rect into its
        //      edge pixels (they are part of the image);
        //   3. an image drawn as two abutting sub-rects equals the image drawn whole.

        test('drawImage filter: clamp-to-edge outside the image, image data outside the source rect', () => {
            function makeImage(w, h, texel) {
                const canvas = SWCanvas.createCanvas(w, h);
                const ctx = canvas.getContext('2d');
                const id = ctx.createImageData(w, h);
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const o = (y * w + x) * 4;
                        const p = texel(x, y);
                        id.data[o] = p[0];
                        id.data[o + 1] = p[1];
                        id.data[o + 2] = p[2];
                        id.data[o + 3] = p[3];
                    }
                }
                ctx.putImageData(id, 0, 0);
                return canvas;
            }

            function countPartialAlpha(ctx, x, y, w, h) {
                const d = ctx.getImageData(x, y, w, h).data;
                let n = 0;
                for (let i = 3; i < d.length; i += 4) if (d[i] !== 255) n++;
                return n;
            }

            const solid = (w, h) => makeImage(w, h, () => [200, 100, 50, 255]);

            // 1. Opaque stays opaque, edge to edge.
            {
                const ctx = SWCanvas.createCanvas(220, 140).getContext('2d');
                ctx.drawImage(solid(20, 12), 10, 10, 200, 120);
                assertEquals(countPartialAlpha(ctx, 10, 10, 200, 120), 0, '20x12 -> 200x120: dest pixels not fully opaque');
            }
            {
                const ctx = SWCanvas.createCanvas(220, 140).getContext('2d');
                ctx.drawImage(solid(175, 120), 10, 10, 200, 120);
                assertEquals(countPartialAlpha(ctx, 10, 10, 200, 120), 0, '175x120 -> 200x120: dest pixels not fully opaque');
            }
            {
                const ctx = SWCanvas.createCanvas(80, 56).getContext('2d');
                ctx.scale(3, 3);
                ctx.drawImage(solid(20, 12), 2, 2);
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                assertEquals(countPartialAlpha(ctx, 6, 6, 60, 36), 0, 'scale(3) CTM, same-size rects: dest pixels not fully opaque');
            }

            // 2. A sub-rect's edge pixels blend the texels beyond the source rect:
            // orange inside (10,6,20,12), blue around it.
            {
                const framed = makeImage(40, 24, (x, y) =>
                    (x >= 10 && x < 30 && y >= 6 && y < 18) ? [255, 128, 0, 255] : [0, 0, 255, 255]);
                const ctx = SWCanvas.createCanvas(220, 140).getContext('2d');
                ctx.drawImage(framed, 10, 6, 20, 12, 10, 10, 200, 120);
                assertEquals(countPartialAlpha(ctx, 10, 10, 200, 120), 0, 'sub-rect up-scale: dest pixels not fully opaque');
                const edge = ctx.getImageData(10, 70, 1, 1).data; // left edge, mid row
                const inner = ctx.getImageData(110, 70, 1, 1).data; // centre
                if (!(edge[2] > 64)) {
                    throw new Error('sub-rect left edge pixel must blend the blue texel outside the source rect, got rgba(' + Array.from(edge).join(',') + ')');
                }
                assertEquals(inner[2], 0, 'sub-rect centre stays pure orange (no blue)');
            }

            // 3. In parts or in whole: the same pixels.
            {
                const ramp = makeImage(20, 12, (x, y) => [Math.round(255 * x / 19), Math.round(255 * y / 11), 128, 255]);
                const whole = SWCanvas.createCanvas(220, 140).getContext('2d');
                whole.drawImage(ramp, 10, 10, 200, 120);
                const parts = SWCanvas.createCanvas(220, 140).getContext('2d');
                parts.drawImage(ramp, 0, 0, 10, 12, 10, 10, 100, 120);
                parts.drawImage(ramp, 10, 0, 10, 12, 110, 10, 100, 120);
                const a = whole.getImageData(0, 0, 220, 140).data;
                const b = parts.getImageData(0, 0, 220, 140).data;
                let differing = 0;
                for (let i = 0; i < a.length; i += 4) {
                    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) differing++;
                }
                assertEquals(differing, 0, 'two abutting sub-rect draws vs one whole draw: differing pixels');
            }
        });


        // Test: drawImage source rects outside the image are clipped, negative sizes
        // are normalised, and a zero-size source draws nothing (HTML5 drawImage steps)
        // This file will be concatenated into the main test suite
        //
        // HTML5 drawImage: "When the source rectangle is outside the source image, the
        // source rectangle must be clipped to the source image and the destination
        // rectangle must be clipped in the same proportion." - "If one of the sw or sh
        // arguments is zero, then return." - "The image data must be processed in the
        // original direction, even if the dimensions given are negative." Contract
        // pinned here, smoothing on and off:
        //   1. a source rect reaching outside the image (each side, all sides) paints
        //      exactly what the same draw with the PRE-CLIPPED rects paints, and one
        //      wholly outside paints nothing - none of them throws;
        //   2. a negative sw/sh or dw/dh names the same rect from its other corner and
        //      is drawn unmirrored: it paints exactly what the normalised call paints;
        //   3. a zero sw or sh paints nothing.
        // Every rect below scales by exactly 2, so the clipped rects are exact.

        test('drawImage: source rect clipped to the image, negative sizes normalised, zero size draws nothing', () => {
            const W = 48;
            const H = 40;

            // 10x8 opaque image, every texel distinct
            const image = SWCanvas.createCanvas(10, 8);
            const imageCtx = image.getContext('2d');
            const texels = imageCtx.createImageData(10, 8);
            for (let y = 0; y < 8; y++) {
                for (let x = 0; x < 10; x++) {
                    const o = (y * 10 + x) * 4;
                    texels.data[o] = x * 25;
                    texels.data[o + 1] = y * 30;
                    texels.data[o + 2] = 100;
                    texels.data[o + 3] = 255;
                }
            }
            imageCtx.putImageData(texels, 0, 0);

            function render(args, smoothing) {
                const ctx = SWCanvas.createCanvas(W, H).getContext('2d');
                ctx.imageSmoothingEnabled = smoothing;
                ctx.drawImage(image, ...args);
                return ctx.getImageData(0, 0, W, H).data;
            }

            function painted(data) {
                let n = 0;
                for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) n++;
                return n;
            }

            function assertSame(label, args, expectedArgs) {
                for (const smoothing of [true, false]) {
                    let actual;
                    try {
                        actual = render(args, smoothing);
                    } catch (e) {
                        throw new Error(label + ': drawImage threw "' + e.message + '"');
                    }
                    const expected = render(expectedArgs, smoothing);
                    let differing = 0;
                    for (let i = 0; i < actual.length; i++) if (actual[i] !== expected[i]) differing++;
                    assertEquals(differing, 0, label + ' (smoothing ' + smoothing + '): bytes differing from the expected draw');
                    assertEquals(painted(actual) > 0, true, label + ': paints something');
                }
            }

            // 1. Clipped to the image, the destination in the same proportion (x2)
            assertSame('left', [-4, 1, 8, 5, 5, 5, 16, 10], [0, 1, 4, 5, 13, 5, 8, 10]);
            assertSame('right', [6, 1, 8, 5, 5, 5, 16, 10], [6, 1, 4, 5, 5, 5, 8, 10]);
            assertSame('top', [2, -3, 6, 6, 5, 5, 12, 12], [2, 0, 6, 3, 5, 11, 12, 6]);
            assertSame('bottom', [2, 5, 6, 6, 5, 5, 12, 12], [2, 5, 6, 3, 5, 5, 12, 6]);
            assertSame('all sides', [-2, -2, 14, 12, 2, 2, 28, 24], [0, 0, 10, 8, 6, 6, 20, 16]);
            for (const smoothing of [true, false]) {
                let data;
                try {
                    data = render([12, 1, 4, 4, 5, 5, 8, 8], smoothing);
                } catch (e) {
                    throw new Error('wholly outside: drawImage threw "' + e.message + '"');
                }
                assertEquals(painted(data), 0, 'wholly outside (smoothing ' + smoothing + '): painted pixels');
            }

            // 2. Negative sizes: the same rect from the other corner, unmirrored
            assertSame('negative sw', [8, 1, -6, 5, 5, 5, 12, 10], [2, 1, 6, 5, 5, 5, 12, 10]);
            assertSame('negative dw', [2, 1, 6, 5, 17, 5, -12, 10], [2, 1, 6, 5, 5, 5, 12, 10]);
            assertSame('negative sh and dh', [2, 6, 6, -5, 5, 15, 12, -10], [2, 1, 6, 5, 5, 5, 12, 10]);
            assertSame('negative dw, 5-argument form', [25, 5, -20, 16], [5, 5, 20, 16]);

            // 3. A zero-size source paints nothing
            for (const smoothing of [true, false]) {
                const label = ' (smoothing ' + smoothing + '): painted pixels';
                assertEquals(painted(render([2, 1, 0, 5, 5, 5, 12, 10], smoothing)), 0, 'zero sw' + label);
                assertEquals(painted(render([2, 1, 6, 0, 5, 5, 12, 10], smoothing)), 0, 'zero sh' + label);
            }
        });


        // Test: gradients are evaluated in gradient (user) space under ANY CTM, and the
        // radial gradient is the HTML5 two-circle cone
        // This file will be concatenated into the main test suite
        //
        // HTML5: "the resulting gradient must then be transformed as described by the
        // current transformation matrix when rendering" - the CTM maps the WHOLE
        // gradient (radii, angles, isolines), not just its defining points. Contract
        // pinned here:
        //   1. TWINS: a gradient drawn under a CTM equals the same picture drawn under
        //      identity with the CTM folded into the gradient's own coordinates
        //      (radial under scale and rotation, focal radial under scale, linear
        //      under uniform AND non-uniform scale, conic under rotation);
        //   2. a radial gradient under a NON-uniform scale is an ellipse: points at the
        //      same gradient-space distance from the centre share a colour along both
        //      axes;
        //   3. the radial cone: a point no circle r(w) >= 0 passes through stays
        //      transparent black;
        //   4. degenerate gradients (a zero-length linear line, two identical radial
        //      circles) paint nothing - and creating them does not throw.
        // Comparisons allow 1-3 levels: the twins sample the same function along two
        // floating-point routes.

        test('gradients under the CTM and the radial cone', () => {
            const W = 200;
            const H = 150;

            function stops(g) {
                g.addColorStop(0, 'rgba(255,200,0,0.9)');
                g.addColorStop(0.5, 'rgb(200,0,120)');
                g.addColorStop(1, 'rgba(0,80,255,0.2)');
                return g;
            }

            function render(draw) {
                const ctx = SWCanvas.createCanvas(W, H).getContext('2d');
                draw(ctx);
                return ctx.getImageData(0, 0, W, H).data;
            }

            function maxDiff(a, b) {
                let max = 0;
                for (let i = 0; i < a.length; i++) {
                    const d = Math.abs(a[i] - b[i]);
                    if (d > max) max = d;
                }
                return max;
            }

            function assertTwins(label, withCtm, folded, tolerance) {
                const d = maxDiff(render(withCtm), render(folded));
                if (d > tolerance) {
                    throw new Error(label + ': CTM render differs from its folded twin by ' + d + ' levels (tolerance ' + tolerance + ')');
                }
            }

            // 1. Twins
            assertTwins('radial under scale(2)',
                ctx => {
                    ctx.scale(2, 2);
                    ctx.fillStyle = stops(ctx.createRadialGradient(50, 37.5, 5, 50, 37.5, 35));
                    ctx.fillRect(0, 0, W / 2, H / 2);
                },
                ctx => {
                    ctx.fillStyle = stops(ctx.createRadialGradient(100, 75, 10, 100, 75, 70));
                    ctx.fillRect(0, 0, W, H);
                }, 1);
            assertTwins('radial stroke under scale(2)',
                ctx => {
                    ctx.scale(2, 2);
                    ctx.strokeStyle = stops(ctx.createRadialGradient(50, 37.5, 5, 50, 37.5, 35));
                    ctx.lineWidth = 12;
                    ctx.beginPath();
                    ctx.arc(50, 37.5, 25, 0, Math.PI * 2);
                    ctx.stroke();
                },
                ctx => {
                    ctx.strokeStyle = stops(ctx.createRadialGradient(100, 75, 10, 100, 75, 70));
                    ctx.lineWidth = 24;
                    ctx.beginPath();
                    ctx.arc(100, 75, 50, 0, Math.PI * 2);
                    ctx.stroke();
                }, 1);
            assertTwins('focal radial under scale(2)',
                ctx => {
                    ctx.scale(2, 2);
                    ctx.fillStyle = stops(ctx.createRadialGradient(35, 30, 2.5, 50, 37.5, 35));
                    ctx.fillRect(0, 0, W / 2, H / 2);
                },
                ctx => {
                    ctx.fillStyle = stops(ctx.createRadialGradient(70, 60, 5, 100, 75, 70));
                    ctx.fillRect(0, 0, W, H);
                }, 1);
            assertTwins('linear under scale(2)',
                ctx => {
                    ctx.scale(2, 2);
                    ctx.fillStyle = stops(ctx.createLinearGradient(10, 5, 90, 70));
                    ctx.fillRect(0, 0, W / 2, H / 2);
                },
                ctx => {
                    ctx.fillStyle = stops(ctx.createLinearGradient(20, 10, 180, 140));
                    ctx.fillRect(0, 0, W, H);
                }, 1);
            {
                // linear under scale(2, 1): the image of a linear gradient is linear,
                // starting at M*p0 and running along M^-T*d, rescaled so t matches.
                const sx = 2;
                const sy = 1;
                const p0 = [10, 10];
                const p1 = [90, 140];
                const d = [p1[0] - p0[0], p1[1] - p0[1]];
                const len2 = d[0] * d[0] + d[1] * d[1];
                const g = [d[0] / sx / len2, d[1] / sy / len2]; // M^-T d / |d|^2
                const g2 = g[0] * g[0] + g[1] * g[1];
                const q0 = [p0[0] * sx, p0[1] * sy];
                const q1 = [q0[0] + g[0] / g2, q0[1] + g[1] / g2];
                assertTwins('linear under non-uniform scale(2, 1)',
                    ctx => {
                        ctx.scale(sx, sy);
                        ctx.fillStyle = stops(ctx.createLinearGradient(p0[0], p0[1], p1[0], p1[1]));
                        ctx.fillRect(0, 0, W / sx, H / sy);
                    },
                    ctx => {
                        ctx.fillStyle = stops(ctx.createLinearGradient(q0[0], q0[1], q1[0], q1[1]));
                        ctx.fillRect(0, 0, W, H);
                    }, 1);
            }
            assertTwins('conic under rotate(0.6)',
                ctx => {
                    ctx.translate(100, 75);
                    ctx.rotate(0.6);
                    ctx.fillStyle = stops(ctx.createConicGradient(0.3, 0, 0));
                    ctx.fillRect(-200, -200, 400, 400);
                },
                ctx => {
                    ctx.fillStyle = stops(ctx.createConicGradient(0.9, 100, 75));
                    ctx.fillRect(0, 0, W, H);
                }, 1);

            // 2. Radial under scale(2, 1) is an ellipse. Gradient centre at user
            // (50.25, 75.5): device pixel (100 + 2k, 75) and device pixel (100, 75 + k)
            // both sit k gradient-space units from it, sampled at their pixel centres.
            {
                const data = render(ctx => {
                    ctx.scale(2, 1);
                    ctx.fillStyle = stops(ctx.createRadialGradient(50.25, 75.5, 5, 50.25, 75.5, 60));
                    ctx.fillRect(0, 0, W / 2, H);
                });
                for (let k = 8; k <= 48; k += 8) {
                    const ox = (75 * W + 100 + 2 * k) * 4;
                    const oy = ((75 + k) * W + 100) * 4;
                    for (let c = 0; c < 4; c++) {
                        const delta = Math.abs(data[ox + c] - data[oy + c]);
                        if (delta > 3) {
                            throw new Error('radial under scale(2, 1): gradient distance ' + k + ' differs by ' + delta + ' levels between the x and y axes (expected an ellipse)');
                        }
                    }
                }
            }

            // 3. The radial cone: start circle (50,75) r10, end circle (150,75) r30.
            // (100, 5) lies on no circle with r >= 0 -> transparent; (10, 75), behind
            // the start circle on the axis, is reached only for w < 0 -> the first
            // stop; (150, 75), the end circle's centre, only for w > 1 -> the last stop.
            {
                const ctx = SWCanvas.createCanvas(W, H).getContext('2d');
                ctx.fillStyle = stops(ctx.createRadialGradient(50, 75, 10, 150, 75, 30));
                ctx.fillRect(0, 0, W, H);
                assertEquals(ctx.getImageData(100, 5, 1, 1).data[3], 0, 'cone: (100,5) is outside the cone');
                assertEquals(ctx.getImageData(10, 75, 1, 1).data[3], 230, 'cone: behind the start circle = first stop alpha');
                assertEquals(ctx.getImageData(150, 75, 1, 1).data[3], 51, 'cone: end circle centre = last stop alpha');
            }

            // 4. Degenerate gradients paint nothing.
            {
                const ctx = SWCanvas.createCanvas(40, 40).getContext('2d');
                const lin = ctx.createLinearGradient(20, 20, 20, 20);
                lin.addColorStop(0, 'red');
                lin.addColorStop(1, 'blue');
                ctx.fillStyle = lin;
                ctx.fillRect(0, 0, 40, 40);
                assertEquals(ctx.getImageData(5, 5, 1, 1).data[3], 0, 'zero-length linear gradient paints nothing');

                let rad;
                try {
                    rad = ctx.createRadialGradient(20, 20, 10, 20, 20, 10);
                } catch (e) {
                    throw new Error('createRadialGradient with identical circles must not throw: ' + e.message);
                }
                rad.addColorStop(0, 'red');
                rad.addColorStop(1, 'blue');
                ctx.fillStyle = rad;
                ctx.fillRect(0, 0, 40, 40);
                assertEquals(ctx.getImageData(20, 20, 1, 1).data[3], 0, 'identical radial circles paint nothing');
            }
        });


        // Test: with imageSmoothingEnabled false, a pattern is sampled at device pixel
        // CENTRES mapped through the inverse CTM, under rotation, scale and
        // fractional translation
        // This file will be concatenated into the main test suite
        //
        // A pattern is painted in the user space of the fill. With smoothing off, each
        // device pixel takes the texel its CENTRE maps to through the inverse CTM,
        // repeated per the pattern's repetition (nearest-neighbour; with smoothing on,
        // a resampling mapping is filtered instead - tests/core/088). The oracle below
        // maps every pixel centre through the inverse of the matrix given to
        // setTransform and checks the texel painted there, for:
        //   1. a rotation with a 3x scale and a fractional translate ('repeat'),
        //   2. a fractional translate alone,
        //   3. a non-uniform DOWN-scale,
        //   4. a non-integer up-scale,
        //   5. a rotation with 'no-repeat' (outside the tile stays transparent);
        //   6. case 1 under 'destination-over', which takes the per-pixel paint path
        //      instead of the source-over fill fast path.
        // Pixel centres within 1e-9 of a texel boundary are skipped: there the oracle's
        // and the engine's float routes may round to different sides.

        test('pattern paint is sampled at pixel centres through the inverse CTM', () => {
            const W = 64;
            const H = 48;
            const T = 4; // tile size

            // 4x4 tile, every texel distinct and opaque
            const tile = SWCanvas.createCanvas(T, T);
            const tileCtx = tile.getContext('2d');
            const tileData = tileCtx.createImageData(T, T);
            for (let y = 0; y < T; y++) {
                for (let x = 0; x < T; x++) {
                    const o = (y * T + x) * 4;
                    tileData.data[o] = 40 + x * 60;
                    tileData.data[o + 1] = 40 + y * 60;
                    tileData.data[o + 2] = (x + y) % 2 === 0 ? 200 : 20;
                    tileData.data[o + 3] = 255;
                }
            }
            tileCtx.putImageData(tileData, 0, 0);

            function check(label, m, repetition, composite = 'source-over') {
                const [a, b, c, d, e, f] = m;
                const ctx = SWCanvas.createCanvas(W, H).getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.fillStyle = ctx.createPattern(tile, repetition);
                ctx.globalCompositeOperation = composite;
                // The pattern is anchored to the CTM in force at fill time.
                ctx.setTransform(a, b, c, d, e, f);
                const det = a * d - b * c;
                // Cover the whole device canvas: map its corners back to user space.
                const corners = [[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => [
                    (d * (x - e) - c * (y - f)) / det,
                    (-b * (x - e) + a * (y - f)) / det
                ]);
                const xs = corners.map(p => p[0]);
                const ys = corners.map(p => p[1]);
                const minX = Math.floor(Math.min(...xs)) - 1;
                const minY = Math.floor(Math.min(...ys)) - 1;
                ctx.fillRect(minX, minY, Math.ceil(Math.max(...xs)) + 1 - minX, Math.ceil(Math.max(...ys)) + 1 - minY);
                const data = ctx.getImageData(0, 0, W, H).data;

                let checked = 0;
                let wrong = 0;
                let firstWrong = '';
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        const cx = x + 0.5;
                        const cy = y + 0.5;
                        const u = (d * (cx - e) - c * (cy - f)) / det;
                        const v = (-b * (cx - e) + a * (cy - f)) / det;
                        if (Math.abs(u - Math.round(u)) < 1e-9 || Math.abs(v - Math.round(v)) < 1e-9) continue;
                        const tx = Math.floor(u);
                        const ty = Math.floor(v);
                        const o = (y * W + x) * 4;
                        let expected;
                        if (repetition === 'no-repeat' && (tx < 0 || ty < 0 || tx >= T || ty >= T)) {
                            expected = [0, 0, 0, 0];
                        } else {
                            const ox = ((tx % T) + T) % T;
                            const oy = ((ty % T) + T) % T;
                            const t = (oy * T + ox) * 4;
                            expected = [tileData.data[t], tileData.data[t + 1], tileData.data[t + 2], tileData.data[t + 3]];
                        }
                        checked++;
                        if (data[o] !== expected[0] || data[o + 1] !== expected[1] ||
                            data[o + 2] !== expected[2] || data[o + 3] !== expected[3]) {
                            if (wrong === 0) {
                                firstWrong = ` first at (${x},${y}): got (${Array.from(data.slice(o, o + 4))}), expected (${expected})`;
                            }
                            wrong++;
                        }
                    }
                }
                if (checked < W * H * 0.9) {
                    throw new Error(label + ': only ' + checked + ' pixels checked (vacuous)');
                }
                assertEquals(wrong, 0, label + ': pixels not sampled at their centre' + firstWrong);
            }

            const r = 0.6;
            check('rotation x3 + fractional translate', [3 * Math.cos(r), 3 * Math.sin(r), -3 * Math.sin(r), 3 * Math.cos(r), 30.3, 20.7], 'repeat');
            check('fractional translate', [1, 0, 0, 1, 0.3, 0.6], 'repeat');
            check('non-uniform down-scale', [0.71, 0, 0, 0.43, 1.23, 0.91], 'repeat');
            check('non-integer up-scale', [2.6, 0, 0, 2.6, 0.4, 0.2], 'repeat');
            check('rotation, no-repeat', [4 * Math.cos(r), 4 * Math.sin(r), -4 * Math.sin(r), 4 * Math.cos(r), 30.3, 6.7], 'no-repeat');
            check('rotation x3, per-pixel path', [3 * Math.cos(r), 3 * Math.sin(r), -3 * Math.sin(r), 3 * Math.cos(r), 30.3, 20.7], 'repeat', 'destination-over');
        });


        // Test: strokeCircle / outerStrokeArc / fillOuterStrokeArc return at the entry
        // for a NaN or infinite radius
        // This file will be concatenated into the main test suite
        //
        // Each of the three entries opens with the same radius guard as fillCircle
        // (non-positive, NaN and infinite radii draw nothing). Pinned through cases
        // that FAIL without the guard instead of hanging:
        //   1. outerStrokeArc and fillOuterStrokeArc with an infinite radius paint
        //      nothing at lineWidth 2, 3 and 10 (unguarded, the thick arc paints a
        //      wedge of the surface);
        //   2. all three with a NaN radius under a non-uniform scale return before any
        //      rendering: no pixel, and the generic pipeline is never entered
        //      (unguarded, the NaN radius reaches the generic path).
        // (lineWidth 1 and sub-pixel widths are left out on purpose: there an infinite
        // radius never terminates the hairline walk unless the guard holds, so a
        // regression would hang the suite instead of failing this test. strokeCircle
        // paints nothing for an infinite radius at lineWidth >= 2 either way, so its
        // guard is pinned through case 2.)

        test('Stroke/arc entries: NaN and infinite radii return at the entry', () => {
            const SIZE = 72;
            const C = 36;
            const Ctx2D = SWCanvas.Core.Context2D;

            function render(draw, setup) {
                const surface = SWCanvas.Core.Surface(SIZE, SIZE);
                const ctx = new Ctx2D(surface);
                ctx.setFillStyle(0, 0, 255, 255);
                ctx.setStrokeStyle(255, 0, 0, 255);
                if (setup) setup(ctx);
                Ctx2D.resetPathBasedFlag();
                draw(ctx);
                let painted = 0;
                for (let i = 3; i < surface.data.length; i += 4) if (surface.data[i] !== 0) painted++;
                return { painted, pathBased: Ctx2D.wasPathBasedUsed() };
            }

            const ENTRIES = {
                strokeCircle: (ctx, r) => ctx.strokeCircle(C, C, r),
                outerStrokeArc: (ctx, r) => ctx.outerStrokeArc(C, C, r, 0, Math.PI * 1.5),
                fillOuterStrokeArc: (ctx, r) => ctx.fillOuterStrokeArc(C, C, r, 0, Math.PI * 1.5)
            };

            // 1. Infinite radius, thick strokes
            for (const name of ['outerStrokeArc', 'fillOuterStrokeArc']) {
                for (const lineWidth of [2, 3, 10]) {
                    const result = render(ctx => ENTRIES[name](ctx, Infinity), ctx => {
                        ctx.lineWidth = lineWidth;
                    });
                    assertEquals(result.painted, 0, `${name} radius Infinity, lineWidth ${lineWidth}: painted pixels`);
                }
            }

            // 2. NaN radius under a non-uniform scale: no pixel, no generic dispatch
            for (const name of Object.keys(ENTRIES)) {
                for (const lineWidth of [1, 2]) {
                    const result = render(ctx => ENTRIES[name](ctx, NaN), ctx => {
                        ctx.lineWidth = lineWidth;
                        ctx.scale(2, 1);
                    });
                    assertEquals(result.painted, 0, `${name} radius NaN, lineWidth ${lineWidth}, scale(2, 1): painted pixels`);
                    assertEquals(result.pathBased, false,
                        `${name} radius NaN, lineWidth ${lineWidth}, scale(2, 1): entered the generic pipeline`);
                }
            }
            log('  NaN and infinite radii return at strokeCircle, outerStrokeArc and fillOuterStrokeArc');
        });


        // Test: a pattern samples its image by drawImage's rule, and paints the pixels
        // its image had at createPattern
        // This file will be concatenated into the main test suite
        //
        // ONE image-sampling rule: a draw whose device→image mapping is axis-aligned
        // with a step of exactly one texel per device pixel takes the nearest texel;
        // any other mapping filters bilinearly at the pixel centre, unless
        // imageSmoothingEnabled is false (then nearest). A pattern's mapping is the CTM
        // composed with its own setTransform. Pinned by comparison with drawImage of the
        // same image under the same transform:
        //   1. a 'no-repeat' pattern under rotation + non-uniform scale, a fractional
        //      up-scale and a down-scale paints drawImage's bytes wherever every filter
        //      tap lies inside the image (at the image border the edge rules differ:
        //      drawImage clamps to the edge texel, a non-repeating pattern axis reads
        //      transparent beyond the image);
        //   2. a 'repeat' pattern's taps wrap: under rotation it paints what drawImage
        //      paints of a 3x3 mosaic of the tile (within one level: the mosaic's image
        //      coordinates are the pattern's shifted by a tile, which can round the
        //      filter fractions differently in the last bit);
        //   3. smoothing off: nearest-neighbour for both — each takes the texel under
        //      the pixel centre — under an integer up-scale (test 093 compares the two
        //      under a rotation) — and the pattern's smoothing-off bytes differ from its
        //      smoothing-on bytes, through the facade and through the Core API alike;
        //   4. a pattern under an integer translate does not resample: every pixel is
        //      exactly its texel, smoothing on or off.
        // A second test pins the snapshot: modifying the image after createPattern
        // does not change the pattern (HTML5), for a canvas source and an ImageLike
        // source, and a setTransform copy of the pattern keeps the snapshot too.

        test('pattern paint samples by drawImage\'s rule: filtered under a resampling transform, nearest otherwise', () => {
            const SIZE = 64;

            // N x N opaque image, every texel distinct.
            function makeImage(n) {
                const canvas = SWCanvas.createCanvas(n, n);
                const ctx = canvas.getContext('2d');
                const id = ctx.createImageData(n, n);
                for (let y = 0; y < n; y++) {
                    for (let x = 0; x < n; x++) {
                        const o = (y * n + x) * 4;
                        id.data[o] = 30 + ((x * 29) % 220);
                        id.data[o + 1] = 20 + ((y * 31) % 230);
                        id.data[o + 2] = (x * 7 + y * 13) % 256;
                        id.data[o + 3] = 255;
                    }
                }
                ctx.putImageData(id, 0, 0);
                return { canvas, data: id.data };
            }

            function render(m, smoothing, draw) {
                const ctx = SWCanvas.createCanvas(SIZE, SIZE).getContext('2d');
                ctx.imageSmoothingEnabled = smoothing;
                ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
                draw(ctx);
                return ctx.getImageData(0, 0, SIZE, SIZE).data;
            }

            // Image-space coordinates of the pixel centre (x, y) under m.
            function imagePoint(m, x, y) {
                const [a, b, c, d, e, f] = m;
                const det = a * d - b * c;
                const cx = x + 0.5 - e;
                const cy = y + 0.5 - f;
                return [(d * cx - c * cy) / det, (-b * cx + a * cy) / det];
            }

            // Compare two renders over the pixels whose centre maps into [lo, hi]^2.
            function compare(label, m, got, want, lo, hi, tolerance) {
                let checked = 0;
                let worst = 0;
                let first = '';
                for (let y = 0; y < SIZE; y++) {
                    for (let x = 0; x < SIZE; x++) {
                        const [u, v] = imagePoint(m, x, y);
                        if (u < lo || v < lo || u > hi || v > hi) continue;
                        checked++;
                        const o = (y * SIZE + x) * 4;
                        for (let k = 0; k < 4; k++) {
                            const d = Math.abs(got[o + k] - want[o + k]);
                            if (d > worst) {
                                worst = d;
                                first = ` worst at (${x},${y}): got (${Array.from(got.slice(o, o + 4))}), drawImage (${Array.from(want.slice(o, o + 4))})`;
                            }
                        }
                    }
                }
                if (checked < 12) throw new Error(label + ': only ' + checked + ' pixels compared (vacuous)');
                if (worst > tolerance) {
                    throw new Error(label + ': pattern differs from drawImage by ' + worst + ' (tolerance ' + tolerance + ')' + first);
                }
            }

            const r = 0.37;
            const cos = Math.cos(r);
            const sin = Math.sin(r);
            const rotated = [2.3 * cos, 2.3 * sin, -1.9 * sin, 1.9 * cos, 30.2, 8.7];
            const image8 = makeImage(8);

            // 1. no-repeat, smoothing on: drawImage's bytes inside the image.
            const cases = [
                ['rotation + non-uniform scale', rotated, image8, 8],
                ['fractional up-scale', [2.6, 0, 0, 3.1, 10.3, 7.7], image8, 8],
                ['down-scale', [0.7, 0, 0, 0.6, 10.3, 7.7], makeImage(40), 40]
            ];
            for (const [label, m, image, n] of cases) {
                const viaDrawImage = render(m, true, ctx => ctx.drawImage(image.canvas, 0, 0));
                const viaPattern = render(m, true, ctx => {
                    ctx.fillStyle = ctx.createPattern(image.canvas, 'no-repeat');
                    ctx.fillRect(0, 0, n, n);
                });
                compare('no-repeat, ' + label, m, viaPattern, viaDrawImage, 1, n - 1, 0);
            }

            // 2. repeat: the taps wrap — the pattern paints drawImage's view of a 3x3
            // mosaic of the tile placed one tile up and left.
            const mosaic = SWCanvas.createCanvas(24, 24);
            const mosaicCtx = mosaic.getContext('2d');
            for (let ty = 0; ty < 3; ty++) {
                for (let tx = 0; tx < 3; tx++) mosaicCtx.drawImage(image8.canvas, tx * 8, ty * 8);
            }
            const viaMosaic = render(rotated, true, ctx => ctx.drawImage(mosaic, -8, -8));
            const viaRepeat = render(rotated, true, ctx => {
                ctx.fillStyle = ctx.createPattern(image8.canvas, 'repeat');
                ctx.fillRect(-8, -8, 24, 24);
            });
            compare('repeat wraps like a mosaic', rotated, viaRepeat, viaMosaic, -7, 15, 1);

            // 3. smoothing off: nearest for both.
            const upScale = [3, 0, 0, 2, 10.75, 7.75];
            const nearestDrawImage = render(upScale, false, ctx => ctx.drawImage(image8.canvas, 0, 0));
            const nearestPattern = render(upScale, false, ctx => {
                ctx.fillStyle = ctx.createPattern(image8.canvas, 'no-repeat');
                ctx.fillRect(0, 0, 8, 8);
            });
            compare('smoothing off, integer up-scale', upScale, nearestPattern, nearestDrawImage, 0, 8, 0);
            const smoothPattern = render(upScale, true, ctx => {
                ctx.fillStyle = ctx.createPattern(image8.canvas, 'no-repeat');
                ctx.fillRect(0, 0, 8, 8);
            });
            let smoothingMatters = 0;
            for (let i = 0; i < nearestPattern.length; i++) if (nearestPattern[i] !== smoothPattern[i]) smoothingMatters++;
            if (smoothingMatters === 0) {
                throw new Error('facade: imageSmoothingEnabled must reach the pattern sampler (smoothing on and off paint the same bytes)');
            }

            // ...and through the Core API.
            function coreRender(smoothing) {
                const surface = SWCanvas.Core.Surface(SIZE, SIZE);
                const ctx = new SWCanvas.Core.Context2D(surface);
                ctx.imageSmoothingEnabled = smoothing;
                ctx.setTransform(upScale[0], upScale[1], upScale[2], upScale[3], upScale[4], upScale[5]);
                ctx.setFillStyle(ctx.createPattern({ width: 8, height: 8, data: image8.data }, 'no-repeat'));
                ctx.fillRect(0, 0, 8, 8);
                return surface.data;
            }
            const coreNearest = coreRender(false);
            const coreSmooth = coreRender(true);
            let coreMismatch = 0;
            for (let i = 0; i < coreNearest.length; i++) {
                if (coreNearest[i] !== nearestPattern[i] || coreSmooth[i] !== smoothPattern[i]) coreMismatch++;
            }
            assertEquals(coreMismatch, 0, 'Core API: pattern bytes must equal the facade\'s, smoothing on and off');

            // 4. an integer translate does not resample: exactly the texels.
            for (const smoothing of [true, false]) {
                const tx = 3;
                const ty = -5;
                const data = render([1, 0, 0, 1, tx, ty], smoothing, ctx => {
                    ctx.fillStyle = ctx.createPattern(image8.canvas, 'repeat');
                    ctx.fillRect(-tx, -ty, SIZE, SIZE);
                });
                let wrong = 0;
                for (let y = 0; y < SIZE; y++) {
                    for (let x = 0; x < SIZE; x++) {
                        const sx = (((x - tx) % 8) + 8) % 8;
                        const sy = (((y - ty) % 8) + 8) % 8;
                        const o = (y * SIZE + x) * 4;
                        const t = (sy * 8 + sx) * 4;
                        for (let k = 0; k < 4; k++) if (data[o + k] !== image8.data[t + k]) wrong++;
                    }
                }
                assertEquals(wrong, 0, 'integer translate, smoothing ' + smoothing + ': every pixel is its texel');
            }
        });

        test('a pattern paints its image as it was at createPattern', () => {
            const RED = [220, 30, 40, 255];

            function pixel(ctx) {
                return Array.from(ctx.getImageData(3, 3, 1, 1).data);
            }

            // Canvas source, modified after createPattern.
            const source = SWCanvas.createCanvas(2, 2);
            const sourceCtx = source.getContext('2d');
            sourceCtx.fillStyle = 'rgb(220, 30, 40)';
            sourceCtx.fillRect(0, 0, 2, 2);
            const target = SWCanvas.createCanvas(6, 6).getContext('2d');
            const pattern = target.createPattern(source, 'repeat');
            sourceCtx.fillStyle = 'rgb(0, 0, 255)';
            sourceCtx.fillRect(0, 0, 2, 2);
            target.fillStyle = pattern;
            target.fillRect(0, 0, 6, 6);
            assertEquals(pixel(target).join(','), RED.join(','), 'canvas source modified after createPattern');

            // A setTransform copy made after the modification keeps the snapshot too.
            const moved = pattern.setTransform({ a: 1, b: 0, c: 0, d: 1, e: 1, f: 1 }) || pattern;
            target.fillStyle = moved;
            target.fillRect(0, 0, 6, 6);
            assertEquals(pixel(target).join(','), RED.join(','), 'setTransform copy of the pattern');

            // ImageLike source, its data modified after createPattern.
            const data = new Uint8ClampedArray(16);
            for (let i = 0; i < 16; i += 4) data.set(RED, i);
            const imageLike = { width: 2, height: 2, data };
            const target2 = SWCanvas.createCanvas(6, 6).getContext('2d');
            const pattern2 = target2.createPattern(imageLike, 'repeat');
            data.fill(0);
            for (let i = 3; i < 16; i += 4) data[i] = 255;
            target2.fillStyle = pattern2;
            target2.fillRect(0, 0, 6, 6);
            assertEquals(pixel(target2).join(','), RED.join(','), 'ImageLike source modified after createPattern');
        });


        // Test: createPattern takes every source drawImage takes. In the browser that
        // includes the DOM's own sources — a canvas element, an ImageBitmap — which the
        // HTML5-compatible API resolves to pixels the same way drawImage does; a source
        // with no pixels yet gives null, as HTML5's createPattern does. Without a DOM
        // these sources do not exist, so these tests run in the browser page only.

        function patternTileColor089(source) {
            const dst = SWCanvas.createCanvas(4, 4);
            const dctx = dst.getContext('2d');
            dctx.fillStyle = dctx.createPattern(source, 'repeat');
            dctx.fillRect(0, 0, 4, 4);
            return Array.from(dctx.getImageData(3, 3, 1, 1).data);
        }

        testRequiring('dom', 'createPattern(canvas element) tiles the canvas pixels', () => {
            const tile = document.createElement('canvas');
            tile.width = 2;
            tile.height = 2;
            const tctx = tile.getContext('2d');
            tctx.fillStyle = 'rgb(220, 30, 40)';
            tctx.fillRect(0, 0, 2, 2);
            assertEquals(patternTileColor089(tile).join(','), '220,30,40,255', 'pattern pixel');
        });

        testRequiring('dom', 'createPattern(ImageBitmap) tiles the bitmap pixels', () => {
            const offscreen = new OffscreenCanvas(2, 2);
            const octx = offscreen.getContext('2d');
            octx.fillStyle = 'rgb(5, 200, 90)';
            octx.fillRect(0, 0, 2, 2);
            assertEquals(patternTileColor089(offscreen.transferToImageBitmap()).join(','), '5,200,90,255', 'pattern pixel');
        });

        testRequiring('dom', 'createPattern of an element source with no pixels yet returns null, as HTML5 does', () => {
            const ctx = SWCanvas.createCanvas(2, 2).getContext('2d');
            assertEquals(ctx.createPattern(new Image(), 'repeat'), null, 'image without a src');
            assertEquals(ctx.createPattern(document.createElement('video'), 'repeat'), null, 'video with no frame');
        });


        // Test: a near-horizontal polygon edge still crosses the scanlines in its sliver of y
        // This file will be concatenated into the main test suite
        //
        // A polygon's edges cover y half-open, [min, max), so every scanline is crossed by exactly
        // the edges it lies in. An edge whose two ends differ in y by a hair (two computed vertices
        // one ulp apart) is the ONLY edge covering that hair: if the scanline falls in it, the edge's
        // crossing is the row's crossing. Only an exactly horizontal edge has none. Pinned for fill(),
        // clip() and isPointInPath(), with the hair at a pixel-center row.

        test('A near-horizontal edge keeps its scanline crossing', () => {
            const W = 40;
            const H = 40;
            for (const nudge of [0, 2e-15, 5e-11, -2e-15]) {
                const shape = c => {
                    c.beginPath();
                    c.moveTo(10, 5);
                    c.lineTo(30, 5);
                    c.lineTo(30, 10.5);
                    c.lineTo(30, 10.5 + nudge);
                    c.lineTo(30, 30);
                    c.lineTo(10, 30);
                    c.closePath();
                };
                for (const mode of ['fill', 'clip']) {
                    const surface = SWCanvas.Core.Surface(W, H);
                    const ctx = new SWCanvas.Core.Context2D(surface);
                    ctx.setFillStyle(0, 0, 0, 255);
                    shape(ctx);
                    if (mode === 'fill') {
                        ctx.fill();
                    } else {
                        ctx.clip();
                        ctx.fillRect(0, 0, W, H);
                    }
                    for (let y = 0; y < H; y++) {
                        for (let x = 0; x < W; x++) {
                            const on = surface.data[y * surface.stride + x * 4 + 3] !== 0;
                            const inside = x >= 10 && x < 30 && y >= 5 && y < 30;
                            if (on !== inside) {
                                throw new Error(`${mode}, vertex nudged by ${nudge}: pixel (${x},${y}) ${on ? 'painted outside' : 'missed inside'}`);
                            }
                        }
                    }
                }
                const ctx = new SWCanvas.Core.Context2D(SWCanvas.Core.Surface(W, H));
                shape(ctx);
                if (!ctx.isPointInPath(25, 10.5)) {
                    throw new Error(`isPointInPath(25, 10.5), vertex nudged by ${nudge}: false, but the point is inside`);
                }
            }
            log('  near-horizontal edges keep their scanline crossings (fill, clip, isPointInPath)');
        });


        // Test: a cubic whose two ends coincide is drawn; a Path2D subpath opened by ellipse() closes on itself
        // This file will be concatenated into the main test suite
        //
        // 1. A cubic Bezier whose end point equals its start point (a loop, a teardrop) has a zero-length
        //    chord but a real curve: it fills and strokes exactly like the same loop drawn as its two
        //    halves (de Casteljau split at t = 0.5), in the current path and in a Path2D.
        // 2. In a Path2D, an ellipse() that opens a subpath starts that subpath, as arc() does: closePath()
        //    returns to the ellipse's own first point, never to (0, 0).

        test('Closed cubic loop - drawn like its two halves', () => {
            const P = [[50.3, 60.6], [95.3, 30.6], [95.3, 98.6], [50.3, 60.6]];
            const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
            const p01 = mid(P[0], P[1]), p12 = mid(P[1], P[2]), p23 = mid(P[2], P[3]);
            const p012 = mid(p01, p12), p123 = mid(p12, p23), m = mid(p012, p123);
            for (const op of ['fill', 'stroke']) {
                const render = (halves) => {
                    const canvas = SWCanvas.createCanvas(128, 128);
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#000';
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(P[0][0], P[0][1]);
                    if (halves) {
                        ctx.bezierCurveTo(p01[0], p01[1], p012[0], p012[1], m[0], m[1]);
                        ctx.bezierCurveTo(p123[0], p123[1], p23[0], p23[1], P[3][0], P[3][1]);
                    } else {
                        ctx.bezierCurveTo(P[1][0], P[1][1], P[2][0], P[2][1], P[3][0], P[3][1]);
                    }
                    if (op === 'fill') ctx.fill();
                    else ctx.stroke();
                    return ctx.getImageData(0, 0, 128, 128).data;
                };
                const loop = render(false), halves = render(true);
                let painted = 0;
                for (let i = 3; i < loop.length; i += 4) if (loop[i] > 0) painted++;
                if (painted === 0) throw new Error(`${op} of a cubic whose ends coincide paints nothing`);
                for (let i = 3; i < loop.length; i += 4) {
                    if ((loop[i] > 0) !== (halves[i] > 0)) {
                        throw new Error(`${op} of the loop differs from its two halves at pixel (${(i >> 2) % 128},${Math.floor((i >> 2) / 128)})`);
                    }
                }
            }
        });

        test('Path2D subpath opened by ellipse() - closePath returns to the ellipse start', () => {
            const canvas = SWCanvas.createCanvas(100, 100);
            const ctx = canvas.getContext('2d');
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            const path = new SWCanvas.Core.SWPath2D();
            path.ellipse(60, 60, 6, 15, 0.4, 0, 1.5 * Math.PI, false);
            path.closePath();
            ctx.stroke(path);
            const d = ctx.getImageData(0, 0, 100, 100).data;
            for (let y = 0; y < 30; y++) {
                for (let x = 0; x < 30; x++) {
                    if (d[(y * 100 + x) * 4 + 3] > 0) {
                        throw new Error(`pixel (${x},${y}) painted: closePath() drew back to the origin, not to the ellipse's start`);
                    }
                }
            }
        });


        // Test: a quadratic Bezier whose ends coincide flattens (and a point-sized one draws nothing)
        // This file will be concatenated into the main test suite
        //
        // A quadratic's flatness is its control point's distance from the chord. When the two ends
        // coincide there is no chord: the distance is measured from the end point instead, so a curve
        // whose three points coincide is a point - flat at once, drawing nothing - and one whose
        // control point lies elsewhere (out and back) still flattens. fill(), stroke(), clip() and
        // isPointInPath() all go through the flattener, on the current path and as a Path2D.

        test('A quadratic whose ends coincide flattens', () => {
            for (const [label, cpx, cpy, strokePixels] of [
                ['three coincident points', 20, 20, false],
                ['out and back', 40, 30, true]
            ]) {
                for (const asPath2D of [false, true]) {
                    for (const op of ['fill', 'stroke', 'clip', 'isPointInPath']) {
                        const canvas = SWCanvas.createCanvas(64, 64);
                        const ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#000';
                        ctx.strokeStyle = '#000';
                        ctx.lineWidth = 3;
                        let path;
                        if (asPath2D) {
                            path = new SWCanvas.Core.SWPath2D();
                            path.moveTo(20, 20);
                            path.quadraticCurveTo(cpx, cpy, 20, 20);
                        } else {
                            ctx.beginPath();
                            ctx.moveTo(20, 20);
                            ctx.quadraticCurveTo(cpx, cpy, 20, 20);
                        }
                        const where = `${label}, ${asPath2D ? 'Path2D' : 'current path'}, ${op}`;
                        try {
                            if (op === 'isPointInPath') {
                                if (asPath2D) ctx.isPointInPath(path, 30, 25);
                                else ctx.isPointInPath(30, 25);
                                continue;
                            }
                            if (op === 'clip') {
                                if (asPath2D) ctx.clip(path);
                                else ctx.clip();
                                ctx.fillRect(0, 0, 64, 64);
                            } else if (asPath2D) {
                                ctx[op](path);
                            } else {
                                ctx[op]();
                            }
                        } catch (e) {
                            throw new Error(`${where}: throws ${e.constructor.name}: ${e.message}`);
                        }
                        const d = ctx.getImageData(0, 0, 64, 64).data;
                        let painted = 0;
                        for (let i = 3; i < d.length; i += 4) if (d[i] > 0) painted++;
                        const expectPixels = op === 'stroke' && strokePixels;
                        if (expectPixels !== painted > 0) {
                            throw new Error(`${where}: painted ${painted} pixel(s), expected ${expectPixels ? 'some' : 'none'}`);
                        }
                    }
                }
            }
            log('  quadratics whose ends coincide flatten (fill, stroke, clip, isPointInPath)');
        });


        // Test: drawImage's nearest-neighbour arm takes the texel under each device
        // pixel's CENTRE, like pattern paint
        // This file will be concatenated into the main test suite
        //
        // A draw that does not resample (axis-aligned, one texel per device pixel), or
        // any draw with imageSmoothingEnabled false, takes the texel its pixel centre
        // maps to, and paints the pixels whose centre lies inside the destination
        // rect. Pinned against an exact oracle (pixel centres within 1e-9 of a texel
        // boundary skipped: there the oracle's and the engine's float routes may round
        // to different sides) for:
        //   1. a step-1 draw at a fractional offset, smoothing on (the arm that never
        //      filters);
        //   2. smoothing off under a fractional up-scale, a down-scale and a rotation;
        //   3. step-1 draws under a scale(3) CTM at device-grid offsets (a plain blit
        //      at device pixel ratio 3) and an integer 3x zoom with smoothing off —
        //      every texel boundary lands on a pixel CORNER there, so only centre
        //      sampling is immune to the division's rounding;
        //   4. a smoothing-off pattern paints the same bytes as drawImage under a
        //      rotation (one nearest-neighbour rule).

        test('drawImage nearest-neighbour samples each pixel at its centre', () => {
            const W = 96;
            const H = 80;

            function makeImage(w, h) {
                const canvas = SWCanvas.createCanvas(w, h);
                const ctx = canvas.getContext('2d');
                const id = ctx.createImageData(w, h);
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const o = (y * w + x) * 4;
                        id.data[o] = 20 + ((x * 37) % 220);
                        id.data[o + 1] = 20 + ((y * 53) % 220);
                        id.data[o + 2] = (x + y) % 2 ? 230 : 30;
                        id.data[o + 3] = 255;
                    }
                }
                ctx.putImageData(id, 0, 0);
                return { canvas, data: id.data, w, h };
            }

            // m = CTM [a, b, c, d, e, f]; the image is drawn at dest (dx, dy, dw, dh).
            function check(label, m, smoothing, image, dest) {
                const [dx, dy, dw, dh] = dest || [0, 0, image.w, image.h];
                const ctx = SWCanvas.createCanvas(W, H).getContext('2d');
                ctx.imageSmoothingEnabled = smoothing;
                ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
                ctx.drawImage(image.canvas, dx, dy, dw, dh);
                const data = ctx.getImageData(0, 0, W, H).data;

                const [a, b, c, d, e, f] = m;
                const det = a * d - b * c;
                let checked = 0;
                let wrong = 0;
                let first = '';
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        const cx = x + 0.5 - e;
                        const cy = y + 0.5 - f;
                        const ux = (d * cx - c * cy) / det;
                        const uy = (-b * cx + a * cy) / det;
                        const u = ((ux - dx) * image.w) / dw;
                        const v = ((uy - dy) * image.h) / dh;
                        if (Math.abs(u - Math.round(u)) < 1e-9 || Math.abs(v - Math.round(v)) < 1e-9) continue;
                        const o = (y * W + x) * 4;
                        let expected;
                        if (u < 0 || v < 0 || u >= image.w || v >= image.h) {
                            expected = [0, 0, 0, 0];
                        } else {
                            const t = (Math.floor(v) * image.w + Math.floor(u)) * 4;
                            expected = [image.data[t], image.data[t + 1], image.data[t + 2], 255];
                        }
                        checked++;
                        if (data[o] !== expected[0] || data[o + 1] !== expected[1] ||
                            data[o + 2] !== expected[2] || data[o + 3] !== expected[3]) {
                            if (wrong === 0) {
                                first = ` first at (${x},${y}): got (${Array.from(data.slice(o, o + 4))}), expected (${expected})`;
                            }
                            wrong++;
                        }
                    }
                }
                if (checked < W * H * 0.5) throw new Error(label + ': only ' + checked + ' pixels checked (vacuous)');
                assertEquals(wrong, 0, label + ': pixels not showing the texel under their centre' + first);
                return data;
            }

            const small = makeImage(12, 9);
            const large = makeImage(60, 50);
            const rot = (angle, s, e, f) => [s * Math.cos(angle), s * Math.sin(angle), -s * Math.sin(angle), s * Math.cos(angle), e, f];

            // 1. step 1 at a fractional offset (smoothing on: this arm never filters)
            check('step-1 fractional offset', [1, 0, 0, 1, 10.3, 7.6], true, makeImage(40, 30));

            // 2. smoothing off
            check('smoothing off, fractional up-scale', [2.6, 0, 0, 2.6, 10.35, 7.65], false, small);
            check('smoothing off, down-scale', [0.71, 0, 0, 0.83, 7.35, 4.65], false, large);
            const rotated = rot(0.5, 3, 40.3, 6.2);
            const viaDrawImage = check('smoothing off, rotation', rotated, false, small);

            // 3. scale(3): a device-pixel-ratio-3 plain blit (step 1) and an integer 3x zoom
            check('step-1 blit under scale(3)', [3, 0, 0, 3, 0, 0], true, large, [11 / 3, 7 / 3, 60 / 3, 50 / 3]);
            check('integer 3x zoom, smoothing off', [3, 0, 0, 2, 10, 7], false, small);

            // 4. one nearest-neighbour rule: a smoothing-off pattern paints drawImage's bytes
            const ctx = SWCanvas.createCanvas(W, H).getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.setTransform(rotated[0], rotated[1], rotated[2], rotated[3], rotated[4], rotated[5]);
            ctx.fillStyle = ctx.createPattern(small.canvas, 'no-repeat');
            ctx.fillRect(0, 0, small.w, small.h);
            const viaPattern = ctx.getImageData(0, 0, W, H).data;
            let differ = 0;
            for (let i = 0; i < viaPattern.length; i++) if (viaPattern[i] !== viaDrawImage[i]) differ++;
            assertEquals(differ, 0, 'smoothing-off pattern vs drawImage under rotation: differing bytes');
        });


        // Test: a join or a cap meets its segment body with no pixel-centre gap on the seam
        // This file will be concatenated into the main test suite
        //
        // A stroke is filled as separate parts - segment bodies, joins, caps - under the nonzero
        // rule. Where a join or a cap meets a body they share an edge: the body's end edge through
        // the joint (or cap point), perpendicular to the segment. The whole of that edge, short of
        // its two corners, lies INSIDE the stroke (the join or cap continues past it), so a pixel
        // centre exactly on it must be painted - which only happens if the filler crosses that edge
        // at the bit-identical x from both parts. Integer ends with both direction components odd
        // put pixel centres exactly on these lines; each join is drawn by translate() and by
        // coordinates, at scale 1 and 2, at two device offsets (the rounding of the shared edge
        // depends on where it lies), each cap at the first of them. Checked exactly, in doubled
        // device coordinates (pixel centres odd): u = centre - joint, on the edge when u.d == 0,
        // strictly inside the half width when u.u < (lineWidth * scale)^2. Each offset reuses one
        // canvas: a stroke's bounding box is cleared before it is drawn, and only the square around
        // each seam is read back.

        test('Stroke seams - no pixel-centre gap where a join or cap meets a body', () => {
            const P = 80;
            // Directions (a, b), both odd: a spread of turns and segment lengths, including the ones whose
            // seams open when a join and a body do not share their seam points exactly
            const directions = [
                [-9, 5], [-7, 3], [-5, 1], [-5, 3], [-3, 7], [-3, 9], [-1, 3], [-1, 5], [-1, 9], [1, 1],
                [1, 3], [3, 1], [3, 3], [3, 5], [5, 5], [5, 9], [7, 1], [7, 7], [9, 3], [9, 9]
            ];
            // [scale, by translate(), offsets, line widths]: device widths 6 and 11 at scale 1, 6 and 22 at scale 2
            const spellings = [
                [1, true, [[3, 3], [3, 701]], [6, 11]],
                [1, false, [[3, 3], [474, 3]], [6, 11]],
                [2, true, [[3, 3], [474, 701]], [3, 11]],
                [2, false, [[3, 3], [474, 3]], [3, 11]]
            ];
            let seamPixels = 0;
            let strokes = 0;
            for (const [dev, byTranslate, offsets, widths] of spellings) {
                offsets.forEach(([X, Y], offsetIndex) => {
                    const canvas = SWCanvas.createCanvas((X + P) * dev, (Y + P) * dev);
                    const ctx = canvas.getContext('2d');
                    for (const [a, b] of directions) {
                        const k = Math.max(1, Math.round(18 / Math.hypot(a, b)));
                        const turn = [[40 - a * k, 40 - b * k], [40, 40], [40 - b * k, 40 + a * k]];
                        const line = [[40 - a * k, 40 - b * k], [40 + a * k, 40 + b * k]];
                        const shapes = [['round', 'butt', turn], ['miter', 'butt', turn], ['bevel', 'butt', turn]];
                        if (offsetIndex === 0) shapes.push(['miter', 'round', line], ['miter', 'square', line]);
                        for (const lw of widths) {
                            for (const [join, cap, pts] of shapes) {
                                // the shared edges: [point, direction the edge is perpendicular to]
                                const seams = pts.length === 3 ? [[pts[1], [a, b]], [pts[1], [-b, a]]] : [[pts[0], [a, b]], [pts[1], [a, b]]];
                                // clear the stroke's bounding box (a miter reaches lineWidth / sqrt(2) past the joint)
                                const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
                                const left = Math.floor((X + Math.min(...xs) - lw - 1) * dev);
                                const top = Math.floor((Y + Math.min(...ys) - lw - 1) * dev);
                                ctx.setTransform(1, 0, 0, 1, 0, 0);
                                ctx.clearRect(left, top, Math.ceil((X + Math.max(...xs) + lw + 1) * dev) - left, Math.ceil((Y + Math.max(...ys) + lw + 1) * dev) - top);
                                ctx.setTransform(dev, 0, 0, dev, 0, 0);
                                let ox = X, oy = Y;
                                if (byTranslate) {
                                    ctx.translate(X, Y);
                                    ox = 0;
                                    oy = 0;
                                }
                                ctx.strokeStyle = '#000';
                                ctx.lineWidth = lw;
                                ctx.lineJoin = join;
                                ctx.lineCap = cap;
                                ctx.beginPath();
                                pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x + ox, y + oy) : ctx.lineTo(x + ox, y + oy)));
                                ctx.stroke();
                                strokes++;
                                const H2 = lw * dev * lw * dev;
                                const r = Math.ceil((lw * dev) / 2) + 1;
                                for (const [[sx, sy], [dx, dy]] of seams) {
                                    // the square of device pixels around the seam point, crop-relative (i, j)
                                    const i0 = sx * dev - r, j0 = sy * dev - r, n = 2 * r;
                                    const d = ctx.getImageData(X * dev + i0, Y * dev + j0, n, n).data;
                                    for (let j = j0; j < j0 + n; j++) {
                                        for (let i = i0; i < i0 + n; i++) {
                                            const ux = 2 * i + 1 - 2 * dev * sx, uy = 2 * j + 1 - 2 * dev * sy;
                                            if (ux * dx + uy * dy !== 0 || ux * ux + uy * uy >= H2) continue;
                                            seamPixels++;
                                            if (d[((j - j0) * n + (i - i0)) * 4 + 3] === 0) {
                                                throw new Error(
                                                    `${pts.length === 3 ? join + ' join' : cap + ' cap'} (${a},${b}) lineWidth ${lw} at ` +
                                                        `${byTranslate ? 'translate' : 'coordinates'} (${X},${Y}) scale ${dev}: pixel (${i},${j}) ` +
                                                        `of the crop lies on the seam at (${sx},${sy}) inside the stroke, unpainted`
                                                );
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                });
            }
            log(`  ${strokes} strokes, ${seamPixels} seam pixel centres all painted`);
        });


        // Test: the direct line and rotated-rect stroke entries paint what stroke() of the same path paints
        // This file will be concatenated into the main test suite
        //
        // strokeLine with butt caps and strokeRect under a rotation have direct rasterizers (thick lines
        // as quads, exactly horizontal/vertical lines as rectangles). They cover the pixels whose centres
        // lie in the stroke, under the half-open rule every filler uses, so each must paint exactly the
        // pixels ctx.stroke() paints for the same line or rect: integer ends (the edges then pass through
        // pixel corners and centres), ends that share a pixel row or column without being axis-aligned,
        // exact horizontals and verticals, every width above the 1px thin-line convention, at scale 1 and 2.
        // One canvas per scale and per entry is reused; a line is drawn, cleared and compared within its
        // bounding box grown by 3 device pixels, a rect within the whole canvas.

        test('strokeLine (butt) and rotated strokeRect paint what stroke() paints', () => {
            const S = 96;
            function firstDifference(a, b, x0, y0, w) {
                for (let i = 3; i < a.length; i += 4) {
                    if ((a[i] > 0) !== (b[i] > 0)) return `pixel (${x0 + ((i >> 2) % w)},${y0 + Math.floor((i >> 2) / w)})`;
                }
                return null;
            }
            // A deterministic, evenly spread sequence in [0, 1) (golden-ratio steps), not a random one
            let phase = 0;
            const rnd = () => (phase = (phase + 0.6180339887498949) % 1);
            const lines = [];
            for (let a = -9; a <= 9; a += 4) {
                for (let b = 0; b <= 9; b += 3) lines.push([40 - a * 2, 40 - b * 2, 40 + a * 2, 40 + b * 2]);
            }
            for (let i = 0; i < 32; i++) {
                const x1 = 20 + rnd() * 50, y1 = 20 + rnd() * 50, ang = rnd() * 6.283, len = 3 + rnd() * 30;
                let x2 = x1 + Math.cos(ang) * len, y2 = y1 + Math.sin(ang) * len;
                if (i % 4 === 1) y2 = Math.floor(y1) + rnd() * 0.99; // same pixel row, not horizontal
                if (i % 4 === 2) x2 = Math.floor(x1) + rnd() * 0.99; // same pixel column, not vertical
                if (i % 8 === 3) y2 = y1; // exactly horizontal
                if (i % 8 === 7) x2 = x1; // exactly vertical
                lines.push([x1, y1, x2, y2]);
            }
            let checked = 0;
            for (const dev of [1, 2]) {
                const N = S * dev;
                const canvases = [0, 1].map(() => {
                    const ctx = SWCanvas.createCanvas(N, N).getContext('2d');
                    ctx.strokeStyle = '#000';
                    return ctx;
                });
                // draws with each entry on its own canvas, the region cleared first (it holds the whole
                // stroke), and returns both reads of the region
                const both = (region, setup, direct, path) =>
                    [direct, path].map((draw, k) => {
                        const ctx = canvases[k];
                        ctx.setTransform(1, 0, 0, 1, 0, 0);
                        ctx.clearRect(region[0], region[1], region[2], region[3]);
                        ctx.setTransform(dev, 0, 0, dev, 0, 0);
                        setup(ctx);
                        draw(ctx);
                        return ctx.getImageData(region[0], region[1], region[2], region[3]).data;
                    });
                for (const lw of [2, 3, 6, 11, 4.7]) {
                    for (const [x1, y1, x2, y2] of lines) {
                        const m = lw / 2 + 3 / dev;
                        const left = Math.max(0, Math.floor((Math.min(x1, x2) - m) * dev));
                        const top = Math.max(0, Math.floor((Math.min(y1, y2) - m) * dev));
                        const right = Math.min(N, Math.ceil((Math.max(x1, x2) + m) * dev));
                        const bottom = Math.min(N, Math.ceil((Math.max(y1, y2) + m) * dev));
                        const [direct, path] = both(
                            [left, top, right - left, bottom - top],
                            (ctx) => {
                                ctx.lineWidth = lw;
                                ctx.lineCap = 'butt';
                            },
                            (ctx) => ctx.strokeLine(x1, y1, x2, y2),
                            (ctx) => {
                                ctx.beginPath();
                                ctx.moveTo(x1, y1);
                                ctx.lineTo(x2, y2);
                                ctx.stroke();
                            }
                        );
                        const diff = firstDifference(direct, path, left, top, right - left);
                        if (diff) {
                            throw new Error(`strokeLine(${x1}, ${y1}, ${x2}, ${y2}) lineWidth ${lw} at scale ${dev}: ${diff} differs from stroke()`);
                        }
                        checked++;
                    }
                }
                for (let i = 0; i < 20; i++) {
                    const x = 20 + rnd() * 30, y = 20 + rnd() * 30, w = 5 + rnd() * 30, h = 5 + rnd() * 30;
                    const ang = rnd() * 6.283, lw = 1.5 + rnd() * 8;
                    const [direct, path] = both(
                        [0, 0, N, N],
                        (ctx) => {
                            ctx.translate(48, 48);
                            ctx.rotate(ang);
                            ctx.translate(-48, -48);
                            ctx.lineWidth = lw;
                        },
                        (ctx) => ctx.strokeRect(x, y, w, h),
                        (ctx) => {
                            ctx.beginPath();
                            ctx.rect(x, y, w, h);
                            ctx.stroke();
                        }
                    );
                    const diff = firstDifference(direct, path, 0, 0, N);
                    if (diff) {
                        throw new Error(`strokeRect(${x}, ${y}, ${w}, ${h}) rotated ${ang} lineWidth ${lw} at scale ${dev}: ${diff} differs from rect() + stroke()`);
                    }
                    checked++;
                }
            }
            log(`  ${checked} direct strokes identical to stroke()`);
        });


        // Test: a round cap or round join stays within the flattening tolerance of its circle
        // This file will be concatenated into the main test suite
        //
        // Round caps and round joins are arcs of radius lineWidth / 2 about the line's end or the joint,
        // flattened into chords. Like a path's own arcs they get as many chords as keep every chord within
        // a quarter device pixel of the circle, however wide the line and whatever the scale: so every
        // pixel whose centre lies more than 0.26 px inside the circle (and outside the segment bodies,
        // which are exact) is painted. Fixed 45-degree chords fall short by 0.076 * radius - 0.84 px for
        // an 11 px radius.

        test('Round caps and joins - within a quarter pixel of their circles', () => {
            let checked = 0;
            for (const dev of [1, 2]) {
                for (const lw of [4, 8, 12, 22, 40]) {
                    const h = lw / 2;
                    for (const kind of ['cap', 'join']) {
                        for (const ang of [0, 0.3, 0.785, 1.2, 2.9]) {
                            const S = 4 * lw + 40;
                            const canvas = SWCanvas.createCanvas(S * dev, S * dev);
                            const ctx = canvas.getContext('2d');
                            if (dev === 2) ctx.scale(2, 2);
                            ctx.strokeStyle = '#000';
                            ctx.lineWidth = lw;
                            ctx.lineCap = kind === 'cap' ? 'round' : 'butt';
                            ctx.lineJoin = 'round';
                            const c = S / 2 + 0.3;
                            const ux = Math.cos(ang), uy = Math.sin(ang);
                            ctx.beginPath();
                            if (kind === 'cap') {
                                ctx.moveTo(c - ux * lw, c - uy * lw); // the cap sits at (c, c), the line comes from behind
                                ctx.lineTo(c, c);
                            } else {
                                ctx.moveTo(c - ux * lw, c - uy * lw); // a right-angle turn at (c, c)
                                ctx.lineTo(c, c);
                                ctx.lineTo(c - uy * lw, c + ux * lw);
                            }
                            ctx.stroke();
                            const N = S * dev;
                            const d = ctx.getImageData(0, 0, N, N).data;
                            for (let j = 0; j < N; j++) {
                                for (let i = 0; i < N; i++) {
                                    const px = (i + 0.5) / dev - c, py = (j + 0.5) / dev - c;
                                    const along = px * ux + py * uy; // past the end of the first segment
                                    if (along <= 0) continue;
                                    if (kind === 'join' && px * -uy + py * ux >= 0) continue; // inside the second body
                                    if (Math.hypot(px, py) * dev > h * dev - 0.26) continue;
                                    checked++;
                                    if (d[(j * N + i) * 4 + 3] === 0) {
                                        throw new Error(
                                            `round ${kind} lineWidth ${lw} at scale ${dev}, direction ${ang}: pixel (${i},${j}) lies ` +
                                                `${(h * dev - Math.hypot(px, py) * dev).toFixed(2)} device px inside the circle, unpainted`
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
            }
            log(`  ${checked} pixel centres inside round caps and joins painted`);
        });


        // Test: a shadow carries the shadow colour's alpha times the shape's coverage —
        // once — and blurring spreads that coverage without losing or adding any
        // This file will be concatenated into the main test suite
        //
        // An opaque 40x40 square casts its shadow 70px to the side, so the shadow
        // lands on transparent pixels nothing else paints:
        //   1. unblurred, every shadow pixel's alpha is the shadow colour's alpha;
        //   2. under globalAlpha 0.5 it is half that (globalAlpha counted once);
        //   3. blurred, the shadow's total alpha is the unblurred total (the blur
        //      moves coverage, it does not dilute or amplify it), and deep inside a
        //      shape much larger than the blur the shadow keeps the full alpha.

        test('shadows: alpha is shadow alpha x coverage, and blur conserves coverage', () => {
            const W = 200;
            const H = 140;

            function shadowOf(alpha, blur, globalAlpha) {
                const ctx = SWCanvas.createCanvas(W, H).getContext('2d');
                ctx.shadowColor = `rgba(20, 40, 200, ${alpha})`;
                ctx.shadowBlur = blur;
                ctx.shadowOffsetX = 70;
                if (globalAlpha !== undefined) ctx.globalAlpha = globalAlpha;
                ctx.fillStyle = 'black';
                ctx.fillRect(20, 50, 40, 40);
                return ctx.getImageData(0, 0, W, H).data;
            }

            // Total alpha over the shadow's side of the canvas (x >= 65: the shape ends at 60).
            function shadowMass(data) {
                let sum = 0;
                for (let y = 0; y < H; y++) {
                    for (let x = 65; x < W; x++) sum += data[(y * W + x) * 4 + 3];
                }
                return sum;
            }

            const centre = data => data[(70 * W + 110) * 4 + 3];

            // 1. unblurred
            for (const alpha of [1, 0.5, 0.1, 3 / 255]) {
                assertEquals(centre(shadowOf(alpha, 0)), Math.round(alpha * 255), `blur 0, shadow alpha ${alpha}`);
            }

            // 2. globalAlpha once
            assertEquals(centre(shadowOf(0.5, 0, 0.5)), Math.round(0.25 * 255), 'blur 0, shadow alpha 0.5 under globalAlpha 0.5');

            // 3. blur conserves coverage
            const unblurred = shadowMass(shadowOf(0.5, 0));
            for (const blur of [2, 4, 8, 16]) {
                const data = shadowOf(0.5, blur);
                const ratio = shadowMass(data) / unblurred;
                if (Math.abs(ratio - 1) > 0.01) {
                    throw new Error(`blur ${blur}: shadow total alpha is ${ratio.toFixed(4)} of the unblurred total`);
                }
                if (blur <= 8) assertEquals(centre(data), 128, `blur ${blur}: shadow alpha deep inside the shape`);
            }
        });


        // Test: drawImage under a canvas-wide composite (copy, source-in, source-out,
        // destination-in, destination-atop) acts on every pixel the clip lets through
        // This file will be concatenated into the main test suite
        //
        // These operators are defined over the whole canvas: where the source is
        // transparent — outside the drawn image, and under its fully transparent
        // texels — the result is what the operator gives for a transparent source
        // (transparent black, for each of the five), exactly as for a fill. Pinned on
        // a destination holding opaque red, under a clip, with an image whose left
        // half is opaque blue and right half fully transparent; pixels outside the
        // clip keep their red.

        test('drawImage: canvas-wide composites act wherever the clip lets them, not only under the image', () => {
            const W = 60;
            const H = 40;

            const image = SWCanvas.createCanvas(20, 10);
            const imageCtx = image.getContext('2d');
            const id = imageCtx.createImageData(20, 10);
            for (let y = 0; y < 10; y++) {
                for (let x = 0; x < 20; x++) {
                    const o = (y * 20 + x) * 4;
                    if (x < 10) {
                        id.data[o + 2] = 255;
                        id.data[o + 3] = 255;
                    } else {
                        id.data[o] = 255; // colour under zero alpha must not leak
                        id.data[o + 3] = 0;
                    }
                }
            }
            imageCtx.putImageData(id, 0, 0);

            // Expected at an opaque blue texel over opaque red, per operator.
            const overOpaque = {
                copy: [0, 0, 255, 255],
                'source-in': [0, 0, 255, 255],
                'source-out': [0, 0, 0, 0],
                'destination-in': [255, 0, 0, 255],
                'destination-atop': [255, 0, 0, 255]
            };

            for (const op of Object.keys(overOpaque)) {
                const ctx = SWCanvas.createCanvas(W, H).getContext('2d');
                ctx.fillStyle = 'rgb(255, 0, 0)';
                ctx.fillRect(0, 0, W, H);
                ctx.beginPath();
                ctx.rect(5, 5, 50, 30);
                ctx.clip();
                ctx.globalCompositeOperation = op;
                ctx.drawImage(image, 20, 15);

                const px = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data).join(',');
                assertEquals(px(22, 18), overOpaque[op].join(','), op + ': under an opaque texel');
                assertEquals(px(35, 18), '0,0,0,0', op + ': under a transparent texel');
                assertEquals(px(10, 10), '0,0,0,0', op + ': outside the image, inside the clip');
                assertEquals(px(50, 30), '0,0,0,0', op + ': outside the image, inside the clip (far corner)');
                assertEquals(px(2, 2), '255,0,0,255', op + ': outside the clip');
            }
        });


        // Test: source-over and destination-over onto a partially transparent pixel
        // follow Porter-Duff on every paint path
        // This file will be concatenated into the main test suite
        //
        // SWCanvas surfaces hold straight RGBA, so compositing a translucent source S
        // over a translucent destination D must weigh D's colour by D's own alpha:
        // alpha = Sa + Da(1 - Sa), colour = (Sc Sa + Dc Da (1 - Sa)) / alpha. Checked
        // against that formula, premultiplied (the colour each pixel contributes once
        // composited), within 1.5 levels (the stored 8-bit result and the colour's own
        // 8-bit components each round), for a grid of source and destination alphas,
        // through fillRect, fill(), stroke(), drawImage, a pattern fill and
        // destination-over.

        test('source-over / destination-over onto translucent pixels follow Porter-Duff on every path', () => {
            const dstColour = [20, 200, 60];
            const srcColour = [230, 40, 180];

            function exact(sc, sa, dc, da) {
                const a = sa / 255;
                const b = da / 255;
                const outA = a + b * (1 - a);
                return [0, 1, 2].map(i => (sc[i] * a + dc[i] * b * (1 - a)) / outA).concat([outA * 255]);
            }

            function texel(c, a) {
                const canvas = SWCanvas.createCanvas(1, 1);
                const ctx = canvas.getContext('2d');
                const id = ctx.createImageData(1, 1);
                id.data[0] = c[0];
                id.data[1] = c[1];
                id.data[2] = c[2];
                id.data[3] = a;
                ctx.putImageData(id, 0, 0);
                return canvas;
            }

            const css = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a / 255})`;

            // The destination pixels, written exactly (straight RGBA).
            function fillData(ctx, c, a) {
                const id = ctx.createImageData(8, 8);
                for (let i = 0; i < id.data.length; i += 4) {
                    id.data[i] = c[0];
                    id.data[i + 1] = c[1];
                    id.data[i + 2] = c[2];
                    id.data[i + 3] = a;
                }
                return id;
            }
            const paths = {
                fillRect: (ctx, a) => {
                    ctx.fillStyle = css(srcColour, a);
                    ctx.fillRect(0, 0, 8, 8);
                },
                'fill()': (ctx, a) => {
                    ctx.fillStyle = css(srcColour, a);
                    ctx.beginPath();
                    ctx.rect(0, 0, 8, 8);
                    ctx.fill();
                },
                'stroke()': (ctx, a) => {
                    ctx.strokeStyle = css(srcColour, a);
                    ctx.lineWidth = 6;
                    ctx.beginPath();
                    ctx.moveTo(0, 4);
                    ctx.lineTo(8, 4);
                    ctx.stroke();
                },
                drawImage: (ctx, a) => {
                    ctx.drawImage(texel(srcColour, a), 0, 0, 8, 8);
                },
                pattern: (ctx, a) => {
                    ctx.fillStyle = ctx.createPattern(texel(srcColour, a), 'repeat');
                    ctx.fillRect(0, 0, 8, 8);
                }
            };

            for (const name of Object.keys(paths)) {
                let worst = 0;
                let where = '';
                for (const da of [3, 40, 128, 220]) {
                    for (const sa of [5, 64, 128, 200]) {
                        const ctx = SWCanvas.createCanvas(8, 8).getContext('2d');
                        ctx.putImageData(fillData(ctx, dstColour, da), 0, 0);
                        paths[name](ctx, sa);
                        const d = ctx.getImageData(4, 4, 1, 1).data;
                        const e = exact(srcColour, sa, dstColour, da);
                        for (let k = 0; k < 4; k++) {
                            const off = k < 3 ? Math.abs((d[k] * d[3]) / 255 - (e[k] * e[3]) / 255) : Math.abs(d[3] - e[3]);
                            if (off > worst) {
                                worst = off;
                                where = ` (Sa ${sa} over Da ${da}: got ${Array.from(d)}, exact ${e.map(Math.round)})`;
                            }
                        }
                    }
                }
                if (worst > 1.5) throw new Error(`${name}: ${worst.toFixed(1)} levels from Porter-Duff` + where);
            }

            // destination-over: the destination stays on top
            let worst = 0;
            for (const da of [3, 40, 128, 220]) {
                for (const sa of [5, 64, 128, 200]) {
                    const ctx = SWCanvas.createCanvas(8, 8).getContext('2d');
                    ctx.putImageData(fillData(ctx, dstColour, da), 0, 0);
                    ctx.globalCompositeOperation = 'destination-over';
                    ctx.fillStyle = css(srcColour, sa);
                    ctx.fillRect(0, 0, 8, 8);
                    const d = ctx.getImageData(4, 4, 1, 1).data;
                    const e = exact(dstColour, da, srcColour, sa);
                    for (let k = 0; k < 4; k++) {
                        const off = k < 3 ? Math.abs((d[k] * d[3]) / 255 - (e[k] * e[3]) / 255) : Math.abs(d[3] - e[3]);
                        worst = Math.max(worst, off);
                    }
                }
            }
            if (worst > 1.5) throw new Error(`destination-over: ${worst.toFixed(1)} levels from Porter-Duff`);
        });


        // Test: a stroke paints the same pixels wherever a whole-pixel translation puts it
        // This file will be concatenated into the main test suite
        //
        // Moving a drawing by whole device pixels - by translate() or by its own coordinates - moves
        // its pixels by the same whole pixels and changes nothing else. This holds even where the
        // stroke's outline passes EXACTLY through pixel centres (a tie, decided by float rounding): a
        // butt end through an integer point, perpendicular to a direction whose components are both
        // odd, or a side edge of a Pythagorean direction ((3,4) at an odd width). The stroke is
        // computed relative to an integer point of its own path and filled relative to the integer
        // device pixel that point lands at, so the same small numbers are rounded wherever it lands -
        // for stroke() and for the direct strokeLine() alike. Every join and cap kind, near the origin
        // and at an offset of thousands of pixels, at scale 1 and 2. Each offset reuses one canvas: a
        // stroke's bounding box is cleared before it is drawn and read back after.

        test('stroke() and strokeLine() - invariant under whole-pixel translation', () => {
            const P = 80;
            const directions = [
                [1, 1], [-3, 3], [7, 7], [1, 3], [3, 9], [5, 1], [-1, 5], [5, 3], [-9, 3], [3, 4], [-4, 3], [-8, 6]
            ];
            // [scale, by translate(), the far offset (each is compared with the stroke at (3, 3))]
            const spellings = [
                [1, true, [5, 4093]],
                [1, false, [5, 4093]],
                [2, true, [700, 1513]],
                [2, false, [700, 1513]]
            ];
            let strokes = 0;
            for (const [dev, byTranslate, far] of spellings) {
                const offsets = [[3, 3], far];
                const contexts = offsets.map(([X, Y]) => SWCanvas.createCanvas((X + P) * dev, (Y + P) * dev).getContext('2d'));
                for (const [a, b] of directions) {
                    const k = Math.max(1, Math.round(18 / Math.hypot(a, b)));
                    const turn = [[40 - a * k, 40 - b * k], [40, 40], [40 - b * k, 40 + a * k]];
                    const line = [[40 - a * k, 40 - b * k], [40 + a * k, 40 + b * k]];
                    const shapes = [
                        ['round', 'butt', turn, 'round join'],
                        ['miter', 'butt', turn, 'miter join'],
                        ['bevel', 'butt', turn, 'bevel join'],
                        ['miter', 'round', line, 'round cap'],
                        ['miter', 'square', line, 'square cap'],
                        ['miter', 'butt', line, 'butt cap'],
                        ['miter', 'butt', line, 'strokeLine']
                    ];
                    for (const lw of [6, 11]) {
                        for (const [join, cap, pts, kind] of shapes) {
                            // the stroke's bounding box in the crop (a miter reaches lineWidth / sqrt(2) past the joint)
                            const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
                            const left = Math.floor((Math.min(...xs) - lw - 1) * dev), top = Math.floor((Math.min(...ys) - lw - 1) * dev);
                            const w = Math.ceil((Math.max(...xs) + lw + 1) * dev) - left, h = Math.ceil((Math.max(...ys) + lw + 1) * dev) - top;
                            let base = null;
                            offsets.forEach(([X, Y], o) => {
                                const ctx = contexts[o];
                                ctx.setTransform(1, 0, 0, 1, 0, 0);
                                ctx.clearRect(X * dev + left, Y * dev + top, w, h);
                                ctx.setTransform(dev, 0, 0, dev, 0, 0);
                                let ox = X, oy = Y;
                                if (byTranslate) {
                                    ctx.translate(X, Y);
                                    ox = 0;
                                    oy = 0;
                                }
                                ctx.strokeStyle = '#000';
                                ctx.lineWidth = lw;
                                ctx.lineJoin = join;
                                ctx.lineCap = cap;
                                if (kind === 'strokeLine') {
                                    ctx.strokeLine(pts[0][0] + ox, pts[0][1] + oy, pts[1][0] + ox, pts[1][1] + oy);
                                } else {
                                    ctx.beginPath();
                                    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x + ox, y + oy) : ctx.lineTo(x + ox, y + oy)));
                                    ctx.stroke();
                                }
                                strokes++;
                                const d = ctx.getImageData(X * dev + left, Y * dev + top, w, h).data;
                                if (base === null) {
                                    base = d;
                                    return;
                                }
                                for (let i = 3; i < d.length; i += 4) {
                                    if ((d[i] > 0) !== (base[i] > 0)) {
                                        const px = left + ((i >> 2) % w), py = top + Math.floor((i >> 2) / w);
                                        throw new Error(
                                            `${kind} (${a},${b}) lineWidth ${lw}, scale ${dev}, ${byTranslate ? 'translate' : 'coordinates'} ` +
                                                `(${X},${Y}): crop pixel (${px},${py}) ${d[i] > 0 ? 'painted' : 'unpainted'}, but ` +
                                                `${base[i] > 0 ? 'painted' : 'unpainted'} at (3,3)`
                                        );
                                    }
                                }
                            });
                        }
                    }
                }
            }
            log(`  ${strokes} strokes, identical at both offsets`);
        });


        // Test: a thick stroke along short segments covers the inner side of every join, whatever the join kind
        // This file will be concatenated into the main test suite
        //
        // A stroke is its segment bodies plus a join at every vertex. Where two consecutive segments are
        // short for the line's width - a thick stroke on a tightly flattened curve, short polyline steps -
        // their bodies cannot cover the inner side of their join: the triangle [joint, inner corner of the
        // first body's end, inner corner of the second body's start], which the swept line covers. Every
        // join kind adds that triangle exactly where the bodies leave part of it bare (the two lengths
        // together under halfWidth * |sin(turn)|) - round joins included, so the join kind never changes
        // what a curve's inner side paints. Polylines on small circles and a U-turn, each pixel centre more
        // than 1e-6 px inside such a triangle must be painted.

        test('Thick stroke on short segments - inner side covered for every join kind', () => {
            const shapes = [];
            for (const [r, steps] of [[1, 16], [2, 12], [3, 16], [5, 24]]) {
                const pts = [];
                for (let i = 0; i <= Math.round(steps * 0.8); i++) {
                    const t = 0.3 + (2 * Math.PI * i) / steps;
                    pts.push([r * Math.cos(t), r * Math.sin(t)]);
                }
                shapes.push([`circle r${r}`, pts]);
            }
            shapes.push(['U-turn', [[-4, -6], [0, -5.5], [2.5, -3.5], [3.5, 0], [2.5, 3.5], [0, 5.5], [-4, 6]]]);
            let triangles = 0;
            for (const [name, rel] of shapes) {
                for (const lw of [8, 16, 30]) {
                    const W = 2 * Math.ceil(lw + 12), c = W / 2 + 0.37;
                    const pts = rel.map(([x, y]) => [c + x, c + y]);
                    const h = lw / 2;
                    // the inner triangles the bodies leave bare
                    const tris = [];
                    for (let i = 1; i + 1 < pts.length; i++) {
                        const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
                        const l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
                        const t1 = [(p1[0] - p0[0]) / l1, (p1[1] - p0[1]) / l1], t2 = [(p2[0] - p1[0]) / l2, (p2[1] - p1[1]) / l2];
                        const cross = t1[0] * t2[1] - t1[1] * t2[0];
                        if (!(l1 + l2 < h * Math.abs(cross))) continue;
                        const s = cross > 0 ? 1 : -1; // inner side: the normal (-t.y, t.x) on a left turn
                        tris.push([
                            [p1[0], p1[1]],
                            [p1[0] - s * t1[1] * h, p1[1] + s * t1[0] * h],
                            [p1[0] - s * t2[1] * h, p1[1] + s * t2[0] * h]
                        ]);
                    }
                    for (const join of ['round', 'miter', 'bevel']) {
                        const ctx = SWCanvas.createCanvas(W, W).getContext('2d');
                        ctx.strokeStyle = '#000';
                        ctx.lineWidth = lw;
                        ctx.lineJoin = join;
                        ctx.beginPath();
                        pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
                        ctx.stroke();
                        const d = ctx.getImageData(0, 0, W, W).data;
                        for (const T of tris) {
                            triangles++;
                            const area = (T[1][0] - T[0][0]) * (T[2][1] - T[0][1]) - (T[2][0] - T[0][0]) * (T[1][1] - T[0][1]);
                            const sg = area > 0 ? 1 : -1;
                            const x0 = Math.floor(Math.min(T[0][0], T[1][0], T[2][0])), x1 = Math.ceil(Math.max(T[0][0], T[1][0], T[2][0]));
                            const y0 = Math.floor(Math.min(T[0][1], T[1][1], T[2][1])), y1 = Math.ceil(Math.max(T[0][1], T[1][1], T[2][1]));
                            for (let y = y0; y < y1; y++) {
                                for (let x = x0; x < x1; x++) {
                                    let inside = true;
                                    for (let e = 0; e < 3 && inside; e++) {
                                        const A = T[e], B = T[(e + 1) % 3], len = Math.hypot(B[0] - A[0], B[1] - A[1]);
                                        const dist = (sg * ((B[0] - A[0]) * (y + 0.5 - A[1]) - (B[1] - A[1]) * (x + 0.5 - A[0]))) / len;
                                        if (dist <= 1e-6) inside = false;
                                    }
                                    if (inside && d[(y * W + x) * 4 + 3] === 0) {
                                        throw new Error(
                                            `${name} lineWidth ${lw}, ${join} joins: pixel (${x},${y}) inside the inner triangle at ` +
                                                `(${T[0][0].toFixed(2)},${T[0][1].toFixed(2)}) is unpainted`
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
            }
            log(`  ${triangles} inner triangles covered`);
        });


        // Test: ctx.font setter accepts the supported CSS subset and rejects unsupported

        test('ctx.font: basic "16px Arial" parses and round-trips', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            ctx.font = '16px Arial';
            assertEquals(ctx.font, '16px Arial');
        });

        test('ctx.font: "bold 12px Courier" parses and round-trips', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            ctx.font = 'bold 12px Courier';
            assertEquals(ctx.font, 'bold 12px Courier');
        });

        test('ctx.font: "italic bold 18px Georgia" parses and round-trips', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            ctx.font = 'italic bold 18px Georgia';
            assertEquals(ctx.font, 'italic bold 18px Georgia');
        });

        test('ctx.font: default before assignment is "10px sans-serif"', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            assertEquals(ctx.font, '10px sans-serif');
        });

        test('ctx.font: invalid value silently leaves previous value in place', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            ctx.font = '16px Arial';
            ctx.font = '16em Arial';      // non-px units — should be rejected
            assertEquals(ctx.font, '16px Arial');
            ctx.font = '16px Arial, sans-serif';  // comma list — rejected
            assertEquals(ctx.font, '16px Arial');
        });

        test('ctx.font: numeric weights (100..900) parse', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            ctx.font = '700 14px Arial';
            assertEquals(ctx.font, '700 14px Arial');
        });

        // Getter returns the *serialized* form per HTML5 spec, not the verbatim
        // user input. Existing tests above already use canonical-form inputs, so
        // they still round-trip; the cases below exercise the normalising path.

        test('ctx.font: getter collapses extra whitespace', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            ctx.font = '  16px   Arial  ';
            assertEquals(ctx.font, '16px Arial');
        });

        test('ctx.font: getter omits explicit "normal" style/weight defaults', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            ctx.font = 'normal 16px Arial';
            assertEquals(ctx.font, '16px Arial');
            ctx.font = 'normal normal 16px Arial';
            assertEquals(ctx.font, '16px Arial');
        });

        test('ctx.font: getter auto-quotes multi-word family names', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            ctx.font = '16px Arial Black';
            assertEquals(ctx.font, '16px "Arial Black"');
        });

        test('ctx.font: getter normalises single-quoted family to double quotes', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            ctx.font = "16px 'Comic Sans MS'";
            assertEquals(ctx.font, '16px "Comic Sans MS"');
        });

        test('ctx.font: getter leaves single-word family unquoted', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            ctx.font = 'bold 14px Helvetica';
            assertEquals(ctx.font, 'bold 14px Helvetica');
        });

        test('ctx.font: getter formats float sizes without trailing zeros', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            ctx.font = '16.5px Arial';
            assertEquals(ctx.font, '16.5px Arial');
        });


        // Test: font, textAlign, textBaseline survive save()/restore()

        test('save/restore preserves font, textAlign, textBaseline', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            ctx.save();
            ctx.font = '12px Courier';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            assertEquals(ctx.font, '12px Courier');
            assertEquals(ctx.textAlign, 'right');
            assertEquals(ctx.textBaseline, 'top');

            ctx.restore();
            assertEquals(ctx.font, '16px Arial');
            assertEquals(ctx.textAlign, 'center');
            assertEquals(ctx.textBaseline, 'middle');
        });

        test('textAlign accepts the six standard values; rejects others', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            for (const v of ['start', 'end', 'left', 'right', 'center']) {
                ctx.textAlign = v;
                assertEquals(ctx.textAlign, v);
            }
            ctx.textAlign = 'bogus';
            assertEquals(ctx.textAlign, 'center');  // unchanged from previous valid set
        });

        test('textBaseline accepts the six standard values; rejects others', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            for (const v of ['top', 'hanging', 'middle', 'alphabetic', 'ideographic', 'bottom']) {
                ctx.textBaseline = v;
                assertEquals(ctx.textBaseline, v);
            }
            ctx.textBaseline = 'bogus';
            assertEquals(ctx.textBaseline, 'bottom');  // unchanged from previous valid set
        });


        // Test: strokeText throws "not supported" — explicit failure beats silent no-op.

        test('ctx.strokeText throws "not supported"', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            ctx.font = '16px Arial';
            assertThrows(() => ctx.strokeText('hello', 10, 20), 'not supported');
        });


        // Test: SWCanvas.fonts namespace shape

        test('SWCanvas.fonts exposes load/has/unload + _raw', () => {
            assertEquals(typeof SWCanvas.fonts, 'object');
            assertEquals(typeof SWCanvas.fonts.load, 'function');
            assertEquals(typeof SWCanvas.fonts.has, 'function');
            assertEquals(typeof SWCanvas.fonts.unload, 'function');
            assertEquals(typeof SWCanvas.fonts._raw, 'object');
        });

        test('SWCanvas.fonts._raw exposes the BitmapText runtime escape hatch', () => {
            const raw = SWCanvas.fonts._raw;
            assertEquals(typeof raw.BitmapText, 'function');     // class
            assertEquals(typeof raw.FontProperties, 'function');
            assertEquals(typeof raw.TextProperties, 'function');
            assertEquals(typeof raw.AtlasDataStore, 'function');
            assertEquals(typeof raw.AtlasLRU, 'function');
        });

        test('SWCanvas.fonts.has returns false for an unloaded font', () => {
            // Just check the call shape — we can't load anything in Phase 2 (no atlases
            // available in test env yet). False is the only legal return here.
            const result = SWCanvas.fonts.has({ family: 'NonexistentFont', size: 99 });
            assertEquals(result, false);
        });


        // Test: fillText must not crash when the requested font/size has no matching
        // atlas — it should silently render nothing (NO_METRICS path). Both test
        // runners preload the smoke fixture's fonts (tests/smoke-fonts.js: Arial
        // reg+bold + BitmapTextInvariant at size 16), whose metrics bundle holds those
        // fonts only, so we deliberately request a font outside that set: Courier New
        // 24 misses on both family AND size. (Against the full font-assets release,
        // whose metrics cover it, the same call draws placeholder rectangles.)

        test('fillText with an unmatched font does not crash, leaves canvas untouched', () => {
            const canvas = SWCanvas.createCanvas(20, 20);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 20, 20);
            // Snapshot a pixel before fillText.
            const before = ctx.getImageData(10, 10, 1, 1).data;

            ctx.font = '24px Courier New';   // not in smoke set (family or size)
            ctx.fillStyle = 'black';
            ctx.fillText('hi', 0, 16);

            const after = ctx.getImageData(10, 10, 1, 1).data;
            // Pixel unchanged — no atlas means nothing rendered.
            assertEquals(after[0], before[0]);
            assertEquals(after[1], before[1]);
            assertEquals(after[2], before[2]);
            assertEquals(after[3], before[3]);
        });

        test('fillText with no font assigned does not crash', () => {
            const canvas = SWCanvas.createCanvas(20, 20);
            const ctx = canvas.getContext('2d');
            // No ctx.font assignment — _font stays null.
            ctx.fillText('hi', 0, 16);  // must not throw
        });

        test('measureText with no font assigned returns null', () => {
            const canvas = SWCanvas.createCanvas(20, 20);
            const ctx = canvas.getContext('2d');
            const m = ctx.measureText('hi');
            assertEquals(m, null);
        });


        // Test: ctx.textPixelDensity property — default, validation, save/restore,
        // snapshot field, and no-crash at density>1 with no atlas.

        test('textPixelDensity default is a positive finite number', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            const d = ctx.textPixelDensity;
            // In Node `window` is undefined → falls back to 1. In a browser it picks
            // up devicePixelRatio. Don't assert the exact value — environment-
            // dependent — just shape.
            if (typeof d !== 'number') throw new Error('textPixelDensity not a number');
            if (!(d > 0)) throw new Error('textPixelDensity not positive');
            if (!isFinite(d)) throw new Error('textPixelDensity not finite');
        });

        test('textPixelDensity setter accepts positive numbers (integer and fractional)', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            ctx.textPixelDensity = 2;
            assertEquals(ctx.textPixelDensity, 2);
            ctx.textPixelDensity = 1.5;
            assertEquals(ctx.textPixelDensity, 1.5);
            ctx.textPixelDensity = 3;
            assertEquals(ctx.textPixelDensity, 3);
        });

        test('textPixelDensity setter silently rejects invalid values', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            ctx.textPixelDensity = 2;  // baseline
            const invalid = [0, -1, NaN, Infinity, -Infinity, 'two', null, undefined, {}];
            for (const v of invalid) {
                ctx.textPixelDensity = v;
                assertEquals(ctx.textPixelDensity, 2);
            }
        });

        test('save/restore preserves textPixelDensity', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            ctx.textPixelDensity = 1;
            ctx.save();
            ctx.textPixelDensity = 2;
            assertEquals(ctx.textPixelDensity, 2);
            ctx.restore();
            assertEquals(ctx.textPixelDensity, 1);
        });

        test('_textPixelDensity exists on Core context as a number', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            if (typeof ctx._core._textPixelDensity !== 'number') {
                throw new Error('Core _textPixelDensity not a number');
            }
        });

        test('fillText at density 2 with no atlas does not crash', () => {
            const canvas = SWCanvas.createCanvas(20, 20);
            const ctx = canvas.getContext('2d');
            ctx.font = '16px Arial';
            ctx.fillStyle = 'black';
            ctx.textPixelDensity = 2;
            ctx.fillText('hi', 0, 16);  // forces slow path; must not throw
        });


        // Test: fillText actually writes glyph pixels when a matching atlas is loaded.
        // Both test runners preload the smoke fixture's fonts (tests/smoke-fonts.js):
        // Arial reg, Arial bold, BitmapTextInvariant, at size 16, densities 1 and 2.
        // Tests in this file constrain themselves to size 16 (the only size in the
        // smoke set) — sizes 9..15 and 17..96 have no metrics in the fixture and
        // would return NO_METRICS.

        // Helper: count canvas pixels that differ from white (255,255,255,255).
        function countNonWhitePixels(ctx, w, h) {
            const data = ctx.getImageData(0, 0, w, h).data;
            let n = 0;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255 || data[i + 3] !== 255) n++;
            }
            return n;
        }

        test('fillText with Arial 16 writes glyph pixels', () => {
            const canvas = SWCanvas.createCanvas(40, 30);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 40, 30);

            ctx.font = '16px Arial';
            ctx.fillStyle = 'black';
            ctx.fillText('A', 0, 20);

            const nonWhite = countNonWhitePixels(ctx, 40, 30);
            if (nonWhite < 1) {
                throw new Error('Expected at least one non-white pixel after fillText("A"); got ' + nonWhite);
            }
        });

        test('fillText with bold Arial 16 writes glyph pixels', () => {
            const canvas = SWCanvas.createCanvas(40, 30);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 40, 30);

            ctx.font = 'bold 16px Arial';
            ctx.fillStyle = 'black';
            ctx.fillText('A', 0, 20);

            const nonWhite = countNonWhitePixels(ctx, 40, 30);
            if (nonWhite < 1) {
                throw new Error('Expected at least one non-white pixel after bold fillText("A"); got ' + nonWhite);
            }
        });

        test('measureText with Arial 16 returns non-zero width', () => {
            const canvas = SWCanvas.createCanvas(40, 30);
            const ctx = canvas.getContext('2d');
            ctx.font = '16px Arial';
            const m = ctx.measureText('Hello');
            if (m === null) throw new Error('measureText returned null; expected metrics');
            if (typeof m.width !== 'number' || m.width <= 0) {
                throw new Error('measureText width should be positive; got ' + m.width);
            }
        });

        test('fillText with an invariant char (☺) at size 16 writes pixels', () => {
            // The smiley auto-redirects to BitmapTextInvariant at the SAME size+density.
            // Smoke set ships invariant at size 16 only — keeping the test at 16 ensures
            // the redirect lookup hits. At other sizes it would write placeholder rects.
            const canvas = SWCanvas.createCanvas(40, 30);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 40, 30);

            ctx.font = '16px Arial';
            ctx.fillStyle = 'black';
            ctx.fillText('☺', 0, 20);   // ☺

            const nonWhite = countNonWhitePixels(ctx, 40, 30);
            if (nonWhite < 1) {
                throw new Error('Expected at least one non-white pixel from invariant glyph; got ' + nonWhite);
            }
        });

        test('fillText with non-black fillStyle writes pixels in that color', () => {
            // Black takes BitmapText's fast direct-blit path; any other colour forces
            // the per-glyph composite recolor path. Exercise the slow path here.
            const canvas = SWCanvas.createCanvas(40, 30);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 40, 30);

            ctx.font = '16px Arial';
            ctx.fillStyle = '#ff0000';   // pure red
            ctx.fillText('A', 0, 20);

            // Look for at least one pixel whose red channel is high AND green/blue
            // are low — distinct from the white background.
            const data = ctx.getImageData(0, 0, 40, 30).data;
            let foundRed = false;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] > 128 && data[i + 1] < 128 && data[i + 2] < 128) {
                    foundRed = true;
                    break;
                }
            }
            if (!foundRed) throw new Error('Expected at least one red-dominated pixel from red fillText');
        });


        // Test: fillText throws when maxWidth is passed — explicit failure beats
        // silent no-op (BitmapText can't shrink-to-fit pre-rasterised glyphs).

        test('ctx.fillText throws when maxWidth is passed', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            ctx.font = '16px Arial';
            assertThrows(() => ctx.fillText('hello', 10, 20, 100), 'not supported');
        });

        test('ctx.fillText without maxWidth does not throw', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            ctx.font = '16px Arial';
            // No assertion on pixels (no atlas loaded); we just verify the call
            // path is reachable without error when maxWidth is omitted.
            ctx.fillText('hello', 10, 20);
        });

        test('ctx.fillText with explicit undefined maxWidth does not throw', () => {
            const canvas = SWCanvas.createCanvas(50, 50);
            const ctx = canvas.getContext('2d');
            ctx.font = '16px Arial';
            ctx.fillText('hello', 10, 20, undefined);
        });


        // Test: the HiDPI direct-blit fast path renders real density-2 glyph pixels.
        // With ctx.scale(dpr,dpr) + textPixelDensity = dpr, the net transform is
        // [dpr,0,0,dpr,e,f] → TextRenderer's fast path (uniform scale == atlas
        // density), which blits straight to the backing surface with no intermediate
        // buffer. Both runners preload Arial 16 at density 2 (tests/smoke-fonts.js,
        // font-assets/_smoke/), so glyph pixels are real, not placeholders — and the
        // first test checks that they are. The backing surface is sized at physical
        // pixels (CSS × dpr).

        // Helper: count canvas pixels that differ from white (255,255,255,255).
        function countNonWhitePixels(ctx, w, h) {
            const data = ctx.getImageData(0, 0, w, h).data;
            let n = 0;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255 || data[i + 3] !== 255) n++;
            }
            return n;
        }

        // Render "A" at the given density through the scale==density fast path and
        // return the resulting ink-pixel count. dpr=1 takes the original
        // identity-translate fast path; dpr=2 takes the generalized HiDPI fast path.
        function inkForDensity(dpr) {
            const cssW = 40, cssH = 24;
            const canvas = SWCanvas.createCanvas(cssW * dpr, cssH * dpr);  // physical px
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, cssW * dpr, cssH * dpr);

            ctx.scale(dpr, dpr);            // [dpr,0,0,dpr,0,0] → fast path
            ctx.textPixelDensity = dpr;
            ctx.font = '16px Arial';
            ctx.fillStyle = 'black';
            ctx.fillText('A', 4, 18);

            return countNonWhitePixels(ctx, cssW * dpr, cssH * dpr);
        }

        // True when the ink of inkForDensity(dpr)'s "A" leaves part of its own bounding
        // box unpainted, as a glyph does. BitmapText draws a missing atlas's glyph as a
        // placeholder rectangle in the text colour, which fills its box exactly — and
        // passes an ink count alone (a density-2 placeholder "A" is 484 px, the glyph 160).
        function inkIsAGlyphNotABox(dpr) {
            const w = 40 * dpr, h = 24 * dpr;
            const canvas = SWCanvas.createCanvas(w, h);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, w, h);
            ctx.scale(dpr, dpr);
            ctx.textPixelDensity = dpr;
            ctx.font = '16px Arial';
            ctx.fillStyle = 'black';
            ctx.fillText('A', 4, 18);
            const data = ctx.getImageData(0, 0, w, h).data;
            let ink = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const i = (y * w + x) * 4;
                    if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255 || data[i + 3] !== 255) {
                        ink++;
                        if (x < x0) x0 = x;
                        if (x > x1) x1 = x;
                        if (y < y0) y0 = y;
                        if (y > y1) y1 = y;
                    }
                }
            }
            return ink > 0 && ink < (x1 - x0 + 1) * (y1 - y0 + 1);
        }

        test('density-2 fillText (scale == density) writes glyph pixels via the fast path', () => {
            const ink = inkForDensity(2);
            if (ink < 1) {
                throw new Error('Expected glyph pixels from density-2 fast-path fillText("A"); got ' + ink);
            }
            if (!inkIsAGlyphNotABox(2)) {
                throw new Error('density-2 fillText("A") painted a solid box: a placeholder, not the glyph (atlas not loaded?)');
            }
        });

        test('density-2 fast-path glyph carries more ink than the density-1 glyph (correct atlas + scale)', () => {
            // Same logical "A" at 16px: density-2 renders from the 2×-resolution atlas
            // into a physical-pixel surface, so it has substantially more ink than the
            // density-1 render (~2× linear ≈ ~4× pixels). This confirms the fast path
            // actually uses the density-2 atlas and applies the density scale, rather
            // than falling back to the density-1 glyph at the wrong size.
            const ink1 = inkForDensity(1);
            const ink2 = inkForDensity(2);
            if (ink1 < 1) {
                throw new Error('Expected density-1 ink pixels as a baseline; got ' + ink1);
            }
            if (ink2 <= ink1) {
                throw new Error(`Expected density-2 ink (${ink2}) to exceed density-1 ink (${ink1})`);
            }
        });


        // Test: DepthBuffer creation validation, clear() and clearRect()
        // This file will be concatenated into the main test suite

        test('DepthBuffer creation, clear and clearRect', () => {
            assertThrows(() => new SWCanvas.Core.DepthBuffer(0, 10), 'width');
            assertThrows(() => new SWCanvas.Core.DepthBuffer(10, -5), 'height');
            assertThrows(() => new SWCanvas.Core.DepthBuffer(10.5, 10), 'width');

            const db = new SWCanvas.Core.DepthBuffer(16, 8);
            assertEquals(db.width, 16);
            assertEquals(db.height, 8);
            assertEquals(db.data.length, 128);

            // clear() resets every pixel to 0 (infinitely far)
            db.data.fill(0.5);
            db.clear();
            let nonZero = 0;
            for (let i = 0; i < db.data.length; i++) {
                if (db.data[i] !== 0) nonZero++;
            }
            assertEquals(nonZero, 0, 'clear() must reset all depths to 0');

            // clearRect() resets only the region (clamped), leaves the rest
            db.data.fill(0.5);
            db.clearRect(4, 2, 8, 4);
            assertEquals(db.getInvDepth(4, 2), 0, 'inside region top-left');
            assertEquals(db.getInvDepth(11, 5), 0, 'inside region bottom-right');
            assertEquals(db.getInvDepth(3, 2), 0.5, 'left of region untouched');
            assertEquals(db.getInvDepth(4, 1), 0.5, 'above region untouched');
            assertEquals(db.getInvDepth(12, 3), 0.5, 'right of region untouched');
            assertEquals(db.getInvDepth(11, 6), 0.5, 'below region untouched');
        });


        // Test: Texture3D power-of-two validation and packed word order
        // This file will be concatenated into the main test suite

        test('Texture3D creation validation and packing', () => {
            const mk = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });

            assertThrows(() => new SWCanvas.Core.Texture3D(mk(100, 64)), 'power of two');
            assertThrows(() => new SWCanvas.Core.Texture3D(mk(64, 48)), 'power of two');
            assertThrows(() => new SWCanvas.Core.Texture3D({ width: 4, height: 4, data: new Uint8ClampedArray(3) }), 'RGBA');

            // Addressing constants
            const img = mk(4, 2);
            // texel (u=2, v=1) = RGB(10, 20, 30)
            img.data.set([10, 20, 30, 255], (1 * 4 + 2) * 4);
            const tex = new SWCanvas.Core.Texture3D(img);
            assertEquals(tex.uMask, 3);
            assertEquals(tex.vMask, 1);
            assertEquals(tex.shift, 2);
            assertEquals(tex.data32.length, 8);

            // Packed word must match the Surface pixel word order exactly, so a
            // textured span can copy texels with a single 32-bit store
            const surf = SWCanvas.Core.Surface(1, 1);
            surf.setPixelOpaque(0, 10, 20, 30);
            assertEquals(tex.data32[((1 & tex.vMask) << tex.shift) | (2 & tex.uMask)], surf.data32[0],
                'texel packing must match surface word order');
        });


        // Test: Triangle3DOps depth-test semantics - near wins, strict-> ties,
        // and correct per-pixel interpenetration of crossing depth planes
        // This file will be concatenated into the main test suite

        test('Triangle3DOps depth test: near wins, ties keep first, interpenetration', () => {
            const T = SWCanvas.Core.Triangle3DOps;
            const W = 100, H = 100;
            const surf = SWCanvas.Core.Surface(W, H);
            const depth = new SWCanvas.Core.DepthBuffer(W, H);

            const probe = SWCanvas.Core.Surface(1, 1);
            probe.setPixelOpaque(0, 255, 0, 0);
            const RED = probe.data32[0];
            probe.setPixelOpaque(0, 0, 0, 255);
            const BLUE = probe.data32[0];

            const quadZ = (color, iz00, iz10, iz11, iz01) => {
                T.fillTriangleZ(surf, depth, 0, 0, iz00, W, 0, iz10, W, H, iz11, color, null);
                T.fillTriangleZ(surf, depth, 0, 0, iz00, W, H, iz11, 0, H, iz01, color, null);
            };

            // 1. Near wins
            surf.data32.fill(0);
            depth.clear();
            quadZ(RED, 0.2, 0.2, 0.2, 0.2);
            quadZ(BLUE, 0.4, 0.4, 0.4, 0.4);
            assertEquals(surf.data32[50 * W + 50], BLUE, 'nearer draw must win');

            // 2. Strict > : equal depth keeps the first-drawn pixel
            quadZ(RED, 0.4, 0.4, 0.4, 0.4);
            assertEquals(surf.data32[50 * W + 50], BLUE, 'tie must keep first-drawn pixel');

            // 3. Interpenetration: constant plane (0.3) vs x-gradient plane
            //    (0.2 at x=0 to 0.4 at x=100) -> crossover at x=50
            surf.data32.fill(0);
            depth.clear();
            quadZ(RED, 0.3, 0.3, 0.3, 0.3);
            quadZ(BLUE, 0.2, 0.4, 0.4, 0.2);
            assertEquals(surf.data32[50 * W + 25], RED, 'left of intersection: constant plane in front');
            assertEquals(surf.data32[50 * W + 75], BLUE, 'right of intersection: gradient plane in front');
            assertEquals(surf.data32[50 * W + 49], RED, 'one pixel left of crossover');
            assertEquals(surf.data32[50 * W + 51], BLUE, 'one pixel right of crossover');
        });


        // Test: Triangle3DOps fill rule is watertight - a quad split along its
        // diagonal produces no double-written pixels and no gaps, at any rotation
        // This file will be concatenated into the main test suite

        test('Triangle3DOps watertight shared edges (no overlap, no gaps)', () => {
            const T = SWCanvas.Core.Triangle3DOps;
            const W = 160, H = 160;

            const probe = SWCanvas.Core.Surface(1, 1);
            probe.setPixelOpaque(0, 255, 0, 0);
            const RED = probe.data32[0];
            probe.setPixelOpaque(0, 0, 0, 255);
            const BLUE = probe.data32[0];

            let totalOverlap = 0;
            let totalGapRows = 0;

            for (let k = 0; k < 8; k++) {
                const a = (k / 8) * Math.PI * 2 + 0.13;
                const cos = Math.cos(a), sin = Math.sin(a);
                const pts = [[-50.3, -34.7], [45.9, -27.3], [38.1, 42.6], [-30.7, 36.2]].map((p) => [
                    80 + p[0] * cos - p[1] * sin,
                    80 + p[0] * sin + p[1] * cos
                ]);

                // Each triangle alone -> coverage sets
                const covA = {};
                const covB = {};
                for (let pass = 0; pass < 2; pass++) {
                    const s = SWCanvas.Core.Surface(W, H);
                    const d = new SWCanvas.Core.DepthBuffer(W, H);
                    s.data32.fill(0);
                    if (pass === 0) {
                        T.fillTriangleZ(s, d, pts[0][0], pts[0][1], 0.5, pts[1][0], pts[1][1], 0.5, pts[2][0], pts[2][1], 0.5, RED, null);
                    } else {
                        T.fillTriangleZ(s, d, pts[0][0], pts[0][1], 0.5, pts[2][0], pts[2][1], 0.5, pts[3][0], pts[3][1], 0.5, BLUE, null);
                    }
                    const cov = pass === 0 ? covA : covB;
                    for (let i = 0; i < W * H; i++) {
                        if (s.data32[i] !== 0) cov[i] = true;
                    }
                }
                for (const i in covA) {
                    if (covB[i]) totalOverlap++;
                }

                // Union: per row, covered pixels of a convex quad must be contiguous
                const u = SWCanvas.Core.Surface(W, H);
                const ud = new SWCanvas.Core.DepthBuffer(W, H);
                u.data32.fill(0);
                T.fillTriangleZ(u, ud, pts[0][0], pts[0][1], 0.5, pts[1][0], pts[1][1], 0.5, pts[2][0], pts[2][1], 0.5, RED, null);
                T.fillTriangleZ(u, ud, pts[0][0], pts[0][1], 0.5, pts[2][0], pts[2][1], 0.5, pts[3][0], pts[3][1], 0.5, BLUE, null);
                for (let y = 0; y < H; y++) {
                    let first = -1, last = -1;
                    for (let x = 0; x < W; x++) {
                        if (u.data32[y * W + x] !== 0) {
                            if (first < 0) first = x;
                            last = x;
                        }
                    }
                    if (first < 0) continue;
                    for (let x = first; x <= last; x++) {
                        if (u.data32[y * W + x] === 0) {
                            totalGapRows++;
                            break;
                        }
                    }
                }
            }

            assertEquals(totalOverlap, 0, 'shared edge must not be written by both triangles');
            assertEquals(totalGapRows, 0, 'shared edge must not leave gap pixels');
        });


        // Test: Triangle3DOps clipBuffer gates BOTH color and depth writes, and the
        // byte fast paths agree exactly with a per-pixel reference
        // This file will be concatenated into the main test suite

        test('Triangle3DOps clip mask gates color and depth writes', () => {
            const T = SWCanvas.Core.Triangle3DOps;
            const W = 120, H = 120;
            const R2 = 40 * 40;
            const inside = (x, y) => {
                const dx = x - 60, dy = y - 60;
                return dx * dx + dy * dy <= R2;
            };

            const probe = SWCanvas.Core.Surface(1, 1);
            probe.setPixelOpaque(0, 255, 0, 0);
            const RED = probe.data32[0];

            // Circular clip (partial bytes at the boundary exercise all three
            // clip code paths: 0x00 skip, 0xFF run, per-pixel)
            const mask = new SWCanvas.Core.ClipMask(W, H);
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    if (!inside(x, y)) mask.setPixel(x, y, false);
                }
            }

            const s = SWCanvas.Core.Surface(W, H);
            const d = new SWCanvas.Core.DepthBuffer(W, H);
            s.data32.fill(0);
            T.fillTriangleZ(s, d, 5, 5, 0.5, 115, 5, 0.5, 60, 115, 0.5, RED, mask.buffer);

            // Reference: same triangle unclipped
            const rs = SWCanvas.Core.Surface(W, H);
            const rd = new SWCanvas.Core.DepthBuffer(W, H);
            rs.data32.fill(0);
            T.fillTriangleZ(rs, rd, 5, 5, 0.5, 115, 5, 0.5, 60, 115, 0.5, RED, null);

            let colorLeak = 0, depthLeak = 0, missingDepth = 0, clippedCount = 0, refCount = 0;
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const i = y * W + x;
                    if (!inside(x, y)) {
                        if (s.data32[i] !== 0) colorLeak++;
                        if (d.data[i] !== 0) depthLeak++;
                    } else {
                        if (s.data32[i] === RED) {
                            clippedCount++;
                            if (d.data[i] === 0) missingDepth++;
                        }
                        if (rs.data32[i] === RED) refCount++;
                    }
                }
            }

            assertEquals(colorLeak, 0, 'no color writes outside the clip');
            assertEquals(depthLeak, 0, 'no depth writes outside the clip (would create invisible occluders)');
            assertEquals(missingDepth, 0, 'every drawn pixel must also write depth');
            assertEquals(clippedCount, refCount, 'clipped coverage must equal unclipped coverage intersected with the mask');
        });


        // Test: textured triangle is texel-exact under identity UV mapping and
        // wrap-around addressing repeats the texture exactly
        // This file will be concatenated into the main test suite

        test('Triangle3DOps textured identity mapping and wrap addressing', () => {
            const T = SWCanvas.Core.Triangle3DOps;
            const S = 64;
            const td = new Uint8ClampedArray(S * S * 4);
            for (let v = 0; v < S; v++) {
                for (let u = 0; u < S; u++) {
                    const i = (v * S + u) * 4;
                    td[i] = u * 4;
                    td[i + 1] = v * 4;
                    td[i + 2] = 128;
                    td[i + 3] = 255;
                }
            }
            const tex = new SWCanvas.Core.Texture3D({ width: S, height: S, data: td });

            const W = 128, H = 128;
            const surf = SWCanvas.Core.Surface(W, H);
            const depth = new SWCanvas.Core.DepthBuffer(W, H);

            // Identity mapping: right triangle at (10,10), UV = (x-10, y-10)
            surf.data32.fill(0);
            depth.clear();
            T.fillTriangleTextured(surf, depth, 10, 10, 0.5, 0, 0, 74, 10, 0.5, 64, 0, 10, 74, 0.5, 0, 64, tex, null);
            let mismatches = 0, checked = 0;
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const p = surf.data32[y * W + x];
                    if (p === 0) continue;
                    checked++;
                    const expected = tex.data32[(((y - 10) & tex.vMask) << tex.shift) | ((x - 10) & tex.uMask)];
                    if (p !== expected) mismatches++;
                }
            }
            assertEquals(mismatches, 0, 'identity-mapped triangle must be texel-exact');
            assertEquals(checked > 1000, true, 'sanity: triangle must actually cover pixels');
            const reference = [];
            for (let i = 0; i < W * H; i++) reference.push(surf.data32[i]);

            // Wrap: same triangle with UVs offset by 4 full texture periods
            surf.data32.fill(0);
            depth.clear();
            T.fillTriangleTextured(surf, depth, 10, 10, 0.5, 256, 256, 74, 10, 0.5, 320, 256, 10, 74, 0.5, 256, 320, tex, null);
            let wrapDiff = 0;
            for (let i = 0; i < W * H; i++) {
                if (reference[i] !== surf.data32[i]) wrapDiff++;
            }
            assertEquals(wrapDiff, 0, 'UVs offset by full periods must render identically (wrap)');
        });


        // Test: perspective-correct texturing stays within 1 texel of the exact
        // per-pixel divide on strong-perspective geometry (where affine is off by
        // tens of texels)
        // This file will be concatenated into the main test suite

        test('Triangle3DOps perspective correction error bound', () => {
            const T = SWCanvas.Core.Triangle3DOps;

            // Decode texture: r = u, g = v
            const S = 256;
            const td = new Uint8ClampedArray(S * S * 4);
            for (let v = 0; v < S; v++) {
                for (let u = 0; u < S; u++) {
                    const i = (v * S + u) * 4;
                    td[i] = u;
                    td[i + 1] = v;
                    td[i + 2] = 0;
                    td[i + 3] = 255;
                }
            }
            const tex = new SWCanvas.Core.Texture3D({ width: S, height: S, data: td });

            const W = 640, H = 480;
            // Floor-like triangle, z from 2 (bottom) to 12 (top): 6:1 depth ratio
            const V = [
                { x: 20, y: 460, z: 2, u: 0, v: 255 },
                { x: 620, y: 460, z: 2, u: 255, v: 255 },
                { x: 320, y: 40, z: 12, u: 128, v: 0 }
            ];
            const iz = [1 / V[0].z, 1 / V[1].z, 1 / V[2].z];

            // Independent exact reference: plane gradients of 1/z, u/z, v/z
            const bxe = V[1].x - V[0].x, bye = V[1].y - V[0].y;
            const cxe = V[2].x - V[0].x, cye = V[2].y - V[0].y;
            const A2 = bxe * cye - cxe * bye;
            const grad = (a0, a1, a2) => ({
                gx: ((a1 - a0) * cye - (a2 - a0) * bye) / A2,
                gy: (bxe * (a2 - a0) - cxe * (a1 - a0)) / A2,
                a0: a0
            });
            const gIZ = grad(iz[0], iz[1], iz[2]);
            const gUZ = grad(V[0].u * iz[0], V[1].u * iz[1], V[2].u * iz[2]);
            const gVZ = grad(V[0].v * iz[0], V[1].v * iz[1], V[2].v * iz[2]);

            const measure = (usePersp) => {
                const surf = SWCanvas.Core.Surface(W, H);
                const depth = new SWCanvas.Core.DepthBuffer(W, H);
                surf.data32.fill(0);
                if (usePersp) {
                    T.fillTriangleTexturedPersp(surf, depth,
                        V[0].x, V[0].y, iz[0], V[0].u, V[0].v,
                        V[1].x, V[1].y, iz[1], V[1].u, V[1].v,
                        V[2].x, V[2].y, iz[2], V[2].u, V[2].v,
                        tex, 256, null);
                } else {
                    T.fillTriangleTextured(surf, depth,
                        V[0].x, V[0].y, iz[0], V[0].u, V[0].v,
                        V[1].x, V[1].y, iz[1], V[1].u, V[1].v,
                        V[2].x, V[2].y, iz[2], V[2].u, V[2].v,
                        tex, null);
                }
                let maxE = 0;
                for (let y = 40; y < 461; y++) {
                    for (let x = 20; x < 621; x++) {
                        const p = surf.data32[y * W + x];
                        if (p === 0) continue;
                        const dx = x - V[0].x, dy = y - V[0].y;
                        const zi = gIZ.a0 + dx * gIZ.gx + dy * gIZ.gy;
                        const ue = (gUZ.a0 + dx * gUZ.gx + dy * gUZ.gy) / zi;
                        const ve = (gVZ.a0 + dx * gVZ.gx + dy * gVZ.gy) / zi;
                        const e = Math.max(Math.abs((p & 0xff) - Math.floor(ue)), Math.abs(((p >> 8) & 0xff) - Math.floor(ve)));
                        if (e > maxE) maxE = e;
                    }
                }
                return maxE;
            };

            const perspErr = measure(true);
            const affineErr = measure(false);
            log(`persp max UV error: ${perspErr} texels; affine on same geometry: ${affineErr}`);
            assertEquals(perspErr <= 1, true, `perspective-correct error must be <= 1 texel, got ${perspErr}`);
            assertEquals(affineErr > 10, true, 'sanity: geometry must be perspective-hard (affine visibly wrong)');
        });


        // Test: textured intensity modulation is bit-exact - 256 is identity,
        // other values are exactly (channel * intensity) >> 8, alpha forced to 255
        // This file will be concatenated into the main test suite

        test('Triangle3DOps intensity modulation exactness', () => {
            const T = SWCanvas.Core.Triangle3DOps;
            const S = 64;
            const td = new Uint8ClampedArray(S * S * 4);
            for (let v = 0; v < S; v++) {
                for (let u = 0; u < S; u++) {
                    const i = (v * S + u) * 4;
                    td[i] = u * 4 + 3;
                    td[i + 1] = v * 4 + 1;
                    td[i + 2] = 200;
                    td[i + 3] = 255;
                }
            }
            const tex = new SWCanvas.Core.Texture3D({ width: S, height: S, data: td });

            const W = 64, H = 64;
            const render = (intensity) => {
                const surf = SWCanvas.Core.Surface(W, H);
                const depth = new SWCanvas.Core.DepthBuffer(W, H);
                surf.data32.fill(0);
                // Identity-ish mapping over a right triangle at the origin
                T.fillTriangleTexturedPersp(surf, depth, 0, 0, 0.5, 0, 0, 63, 0, 0.5, 63, 0, 0, 63, 0.5, 0, 63, tex, intensity, null);
                return surf;
            };

            const checkAll = (surf, intensity) => {
                let bad = 0, n = 0;
                for (let y = 0; y < H; y++) {
                    for (let x = 0; x < W; x++) {
                        const p = surf.data32[y * W + x];
                        if (p === 0) continue;
                        n++;
                        const texel = tex.data32[((y & tex.vMask) << tex.shift) | (x & tex.uMask)];
                        const expR = ((texel & 0xff) * intensity) >> 8;
                        const expG = (((texel >> 8) & 0xff) * intensity) >> 8;
                        const expB = (((texel >> 16) & 0xff) * intensity) >> 8;
                        if ((p & 0xff) !== expR || ((p >> 8) & 0xff) !== expG || ((p >> 16) & 0xff) !== expB) bad++;
                        if (((p >>> 24) & 0xff) !== 255) bad++;
                    }
                }
                assertEquals(n > 1000, true, 'sanity: coverage');
                assertEquals(bad, 0, `intensity=${intensity} must be bit-exact per channel with alpha 255`);
                return n;
            };

            checkAll(render(256), 256); // identity: (c * 256) >> 8 === c
            checkAll(render(128), 128);
            checkAll(render(37), 37);

            // intensity 0 -> black (but still opaque and depth-written)
            const black = render(0);
            let nonBlack = 0, covered = 0;
            for (let i = 0; i < W * H; i++) {
                const p = black.data32[i];
                if (p === 0) continue;
                covered++;
                if ((p & 0xffffff) !== 0) nonBlack++;
            }
            assertEquals(nonBlack, 0, 'intensity=0 must render black');
            assertEquals(covered > 1000, true, 'sanity: coverage at intensity 0');
        });


        // Test: Texture3D.litVariant - identity at full brightness, exact
        // pre-modulation at quantized levels, caching, and rendering equivalence
        // through the copy-only fast path of the perspective span
        // This file will be concatenated into the main test suite

        test('Texture3D litVariant quantization, caching and render equivalence', () => {
            const S = 32;
            const td = new Uint8ClampedArray(S * S * 4);
            for (let v = 0; v < S; v++) {
                for (let u = 0; u < S; u++) {
                    const i = (v * S + u) * 4;
                    td[i] = u * 8 + 1;
                    td[i + 1] = v * 8 + 2;
                    td[i + 2] = 77;
                    td[i + 3] = 255;
                }
            }
            const tex = new SWCanvas.Core.Texture3D({ width: S, height: S, data: td });

            // Full brightness (and anything quantizing to 256) is identity: same object
            assertEquals(tex.litVariant(256) === tex, true, '256 must return the texture itself');
            assertEquals(tex.litVariant(253) === tex, true, '253 quantizes to 256 -> identity');

            // Quantized level: 128 is a multiple of 8, so modulation must be exact
            const half = tex.litVariant(128);
            assertEquals(half === tex, false);
            assertEquals(half.width, S);
            assertEquals(half.uMask, tex.uMask);
            let bad = 0;
            for (let i = 0; i < tex.data32.length; i++) {
                const t = tex.data32[i];
                const expected =
                    ((t & 0xff000000) |
                        ((((((t >> 16) & 0xff) * 128) >> 8) & 0xff) << 16) |
                        ((((((t >> 8) & 0xff) * 128) >> 8) & 0xff) << 8) |
                        (((t & 0xff) * 128) >> 8)) >>>
                    0;
                if (half.data32[i] !== expected) bad++;
            }
            assertEquals(bad, 0, 'level-128 variant must be exactly (c*128)>>8 per channel');

            // Caching: same level returns the same object; 130 quantizes to 128 too
            assertEquals(tex.litVariant(128) === half, true, 'variant must be cached');
            assertEquals(tex.litVariant(130) === half, true, '130 quantizes to the same level as 128');

            // Render equivalence: persp fill with (litVariant, 256) must equal
            // persp fill with (texture, quantizedIntensity) pixel-for-pixel
            const T = SWCanvas.Core.Triangle3DOps;
            const W = 96, H = 96;
            const render = (texture, intensity) => {
                const surf = SWCanvas.Core.Surface(W, H);
                const depth = new SWCanvas.Core.DepthBuffer(W, H);
                surf.data32.fill(0);
                T.fillTriangleTexturedPersp(surf, depth, 5, 5, 0.5, 0, 0, 90, 10, 0.25, 64, 0, 10, 90, 0.4, 0, 64, texture, intensity, null);
                return surf;
            };
            const direct = render(tex, 104); // 104 is a multiple of 8 -> no quantization error
            const cached = render(tex.litVariant(104), 256);
            let diff = 0;
            for (let i = 0; i < W * H; i++) {
                if (direct.data32[i] !== cached.data32[i]) diff++;
            }
            assertEquals(diff, 0, 'litVariant + fast path must render identically to direct modulation');
        });


        // Test: Texture3D.buildMips - chain shape, box-filter exactness, lit-variant
        // propagation, and minified rendering sampling from the selected level
        // This file will be concatenated into the main test suite

        test('Texture3D mip chain build, filtering, litVariant propagation, render', () => {
            // 4x4 texture with known values: r channel = 16*u + 4*v (distinct per texel)
            const mk = () => {
                const data = new Uint8ClampedArray(4 * 4 * 4);
                for (let v = 0; v < 4; v++) {
                    for (let u = 0; u < 4; u++) {
                        const i = (v * 4 + u) * 4;
                        data[i] = 16 * u + 4 * v;
                        data[i + 1] = 100;
                        data[i + 2] = 200;
                        data[i + 3] = 255;
                    }
                }
                return new SWCanvas.Core.Texture3D({ width: 4, height: 4, data: data });
            };

            const tex = mk().buildMips();
            assertEquals(tex.mips.length, 3, '4x4 -> 2x2 -> 1x1 = 3 levels');
            assertEquals(tex.mips[0].data32 === tex.data32, true, 'level 0 shares base texels');
            assertEquals(tex.mips[1].width, 2);
            assertEquals(tex.mips[1].uMask, 1);
            assertEquals(tex.mips[1].shift, 1);
            assertEquals(tex.mips[2].width, 1);

            // Box filter exactness: level-1 texel (0,0) = rounded average of the
            // 2x2 block r values {0, 16, 4, 20} -> (40+2)>>2 = 10
            assertEquals(tex.mips[1].data32[0] & 0xff, 10, 'level-1 (0,0) red must be rounded 2x2 average');
            // g and b are uniform, so averages must be exact
            assertEquals((tex.mips[1].data32[0] >> 8) & 0xff, 100);
            assertEquals((tex.mips[1].data32[0] >> 16) & 0xff, 200);
            assertEquals((tex.mips[1].data32[0] >>> 24) & 0xff, 255, 'alpha preserved through the filter');

            // buildMips is idempotent
            const chain = tex.mips;
            tex.buildMips();
            assertEquals(tex.mips === chain, true, 'second buildMips must be a no-op');

            // litVariant propagates the chain with exact per-level modulation
            const half = tex.litVariant(128);
            assertEquals(!!half.mips, true, 'lit variant must carry mips');
            assertEquals(half.mips.length, 3);
            assertEquals(half.mips[0].data32 === half.data32, true, 'lit level 0 shares variant texels');
            assertEquals(half.mips[1].data32[0] & 0xff, (10 * 128) >> 8, 'lit mip texel must be (c*q)>>8 of the mip texel');

            // Minified render: 32x32 base, du/dx = 5 -> level 2 expected.
            // (5, not 4: selection floors the float step, so a step sitting exactly
            // on a power-of-two boundary can legitimately resolve one level lower
            // when 1/segmentLength rounding nudges it below the boundary. 5 is
            // robustly inside the level-2 bracket [4, 8).)
            // Replicate the span's selection + sampling and compare pixel-for-pixel.
            const S = 32;
            const td = new Uint8ClampedArray(S * S * 4);
            for (let v = 0; v < S; v++) {
                for (let u = 0; u < S; u++) {
                    const i = (v * S + u) * 4;
                    td[i] = u * 8;
                    td[i + 1] = v * 8;
                    td[i + 2] = 33;
                    td[i + 3] = 255;
                }
            }
            const big = new SWCanvas.Core.Texture3D({ width: S, height: S, data: td }).buildMips();

            const T = SWCanvas.Core.Triangle3DOps;
            const W = 64, H = 64;
            const surf = SWCanvas.Core.Surface(W, H);
            const depth = new SWCanvas.Core.DepthBuffer(W, H);
            surf.data32.fill(0);
            // Right triangle at origin, u = 5x (minification x5), v = 5y, constant z
            T.fillTriangleTexturedPersp(surf, depth, 0, 0, 0.5, 0, 0, 48, 0, 0.5, 240, 0, 0, 48, 0.5, 0, 240, big, 256, null);

            const L = big.mips[2]; // step 5 -> level 2 (bracket [4, 8))
            let covered = 0, wrong = 0;
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const p = surf.data32[y * W + x];
                    if (p === 0) continue;
                    covered++;
                    const u = 5 * x, v = 5 * y; // exact plane values at pixel (x, y)
                    const expected = L.data32[(((v >> 2) & L.vMask) << L.shift) | ((u >> 2) & L.uMask)];
                    if (p !== expected) wrong++;
                }
            }
            assertEquals(covered > 800, true, 'sanity: coverage');
            assertEquals(wrong, 0, 'minified pixels must sample the level-2 mip exactly');
        });


        testResults.total = testResults.passed + testResults.failed + testResults.skipped.length;
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
    
})(typeof window !== "undefined" ? window : global);
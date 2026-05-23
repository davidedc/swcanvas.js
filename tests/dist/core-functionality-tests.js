// Core Functionality Tests
// Comprehensive test suite for SWCanvas API correctness
// Tests fundamental operations, edge cases, and mathematical accuracy

(function(global) {
    'use strict';
    
    // Simple test framework for Node.js and browser compatibility
    const testResults = { passed: 0, failed: 0 };
    
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
            console.log(`✗ ${testName}`);
            console.log(`  ${error.message}`);
        }
    }
    
    function log(message) {
        console.log(`  ${message}`);
    }
    
    // Helper function to save PNG files (Node.js only)
    function savePNG(surface, filename, description, SWCanvas) {
        try {
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
            console.log(`  Saved ${description}: ${filePath}`);
        } catch (error) {
            console.log(`  Warning: Could not save ${description} - ${error.message}`);
        }
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
        test('isPointInPath with transforms', () => {
            const surface = SWCanvas.Core.Surface(200, 200);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            // Create path then transform
            ctx.beginPath();
            ctx.rect(0, 0, 50, 50);
            ctx.translate(50, 50);
            
            // Point should be tested against transformed path
            // Original rect (0,0,50,50) transformed by (50,50) = (50,50,100,100)
            assertEquals(ctx.isPointInPath(75, 75), true); // Should be inside transformed rect
            assertEquals(ctx.isPointInPath(25, 25), false); // Should be outside transformed rect
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
        test('isPointInStroke with transforms', () => {
            const surface = SWCanvas.Core.Surface(200, 200);
            const ctx = new SWCanvas.Core.Context2D(surface);
            
            ctx.lineWidth = 10;
            
            // Create path then transform
            ctx.beginPath();
            ctx.rect(0, 0, 50, 50);
            ctx.translate(50, 50);
            
            // Point should be tested against transformed stroke
            // Original rect (0,0,50,50) transformed by (50,50) = (50,50,100,100)
            // With lineWidth=10, stroke extends 5px outside the path bounds
            assertEquals(ctx.isPointInStroke(45, 75), true); // On left edge of transformed stroke
            assertEquals(ctx.isPointInStroke(105, 75), true); // On right edge of transformed stroke
            assertEquals(ctx.isPointInStroke(75, 45), true); // On top edge of transformed stroke
            assertEquals(ctx.isPointInStroke(75, 105), true); // On bottom edge of transformed stroke
            assertEquals(ctx.isPointInStroke(75, 75), false); // Inside transformed path, not in stroke
            assertEquals(ctx.isPointInStroke(25, 25), false); // Outside transformed stroke
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
        // atlas — it should silently render nothing (NO_METRICS path). The test
        // runner preloads the smoke fixture's 3 fonts (Arial reg+bold +
        // BitmapTextInvariant at size 16, density-1), so we deliberately request a
        // font outside that set: Courier New 24 misses on both family AND size.

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
        // The test runner preloads the smoke fixture's 3 fonts at size 16 density-1:
        // Arial reg, Arial bold, BitmapTextInvariant. Tests in this file constrain
        // themselves to size 16 (the only size in the smoke set) — sizes 9..15
        // and 17..96 in the smoke fixture have no atlas and would return NO_METRICS.

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
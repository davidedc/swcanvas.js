// Visual Test Registry
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

    // Test: Simple Rectangle Test
    // This file will be concatenated into the main visual test suite

    registerVisualTest('simple-test', {
        name: 'Create and save a simple test image',
        width: 100, height: 100,
        // Unified drawing function that works with both canvas types
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Fill with red background
            ctx.fillStyle = 'red';
            ctx.fillRect(0, 0, 100, 100);
            
            // Blue square in center
            ctx.fillStyle = 'blue';
            ctx.fillRect(25, 25, 50, 50);
        }
    });

    // Test: Alpha Blending Test
    // This file will be concatenated into the main visual test suite

    registerVisualTest('alpha-test', {
        name: 'Alpha blending test - semi-transparent rectangles',
        width: 200, height: 150,
        // Unified drawing function
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 150);
            
            // Red rectangle (opaque)
            ctx.fillStyle = 'red';
            ctx.fillRect(20, 20, 80, 60);
            
            // Blue rectangle (opaque) with overlap
            ctx.fillStyle = 'blue';
            ctx.fillRect(60, 60, 80, 60);
            
            // Semi-transparent green rectangle
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = 'green';
            ctx.fillRect(40, 40, 80, 60);
            ctx.globalAlpha = 1.0;
        }
    });

    // Test: Triangle Path
    // This file will be concatenated into the main visual test suite

    registerVisualTest('triangle-test', {
        name: 'Path filling - simple triangle',
        width: 100, height: 100,
        // Unified drawing function
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 100, 100);
            
            // Draw red triangle using path
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.moveTo(50, 10);
            ctx.lineTo(80, 70);
            ctx.lineTo(20, 70);
            ctx.closePath();
            ctx.fill();
        }
    });

    // Test: Even-Odd Path
    // This file will be concatenated into the main visual test suite

    registerVisualTest('evenodd-test', {
        name: 'Path filling - evenodd vs nonzero',
        width: 100, height: 100,
        // Unified drawing function
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 100, 100);
            
            // Create overlapping rectangles (outer and inner)
            ctx.fillStyle = 'red';
            ctx.beginPath();
            // Outer rectangle
            ctx.rect(20, 20, 60, 60);
            // Inner rectangle (opposite winding)
            ctx.rect(30, 30, 40, 40);
            
            // Fill with evenodd rule - should create a "hole"
            ctx.fill('evenodd');
        }
    });

    // Test: Basic Clipping
    // This file will be concatenated into the main visual test suite

    registerVisualTest('clipping-test', {
        name: 'Basic clipping test',
        width: 100, height: 100,
        // Unified drawing function
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 100, 100);
            
            // Set up circular clip path
            ctx.beginPath();
            ctx.arc(50, 50, 30, 0, 2 * Math.PI);
            ctx.clip();
            
            // Fill a large red rectangle - should be clipped to circle
            ctx.fillStyle = 'red';
            ctx.fillRect(0, 0, 100, 100);
        }
    });

    // Test: Basic Stroke
    // This file will be concatenated into the main visual test suite

    registerVisualTest('stroke-basic-line', {
        name: 'Basic stroke - simple line',
        width: 100, height: 100,
        // Unified drawing function
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 100, 100);
            
            // Draw red line stroke
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(10, 50);
            ctx.lineTo(90, 50);
            ctx.stroke();
        }
    });

    // Test: Stroke Joins
    // This file will be concatenated into the main visual test suite

    registerVisualTest('stroke-joins', {
        name: 'Stroke joins - miter, bevel, round',
        width: 300, height: 100,
        // Unified drawing function
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 100);
            
            ctx.strokeStyle = 'blue';
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
        }
    });

    // Test: Stroke Curves
    // This file will be concatenated into the main visual test suite

    registerVisualTest('stroke-curves', {
        name: 'Complex path stroke with curves',
        width: 150, height: 150,
        // Unified drawing function
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 150, 150);
            
            // Draw a curved path
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 4;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            
            ctx.beginPath();
            ctx.moveTo(20, 50);
            ctx.quadraticCurveTo(75, 20, 130, 50);
            ctx.quadraticCurveTo(100, 100, 50, 120);
            ctx.lineTo(20, 100);
            ctx.stroke();
        }
    });

    // Test: Stroke Miter Limit (Original Test)
    // This file will be concatenated into the main visual test suite

    registerVisualTest('stroke-miter-limit', {
        name: 'Miter limit test',
        width: 200, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 100);
            
            ctx.strokeStyle = 'magenta';
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
        },
    });

    // Test: Miter Limit Basic Functionality
    // This file will be concatenated into the main visual test suite

    registerVisualTest('miter-limits-basic', {
        name: 'Miter limit property and basic functionality',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 100, 100);
            
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 6;
            ctx.lineJoin = 'miter';
            
            // Test different miter limit values
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
            }
        },
    });

    // Test: Basic Translation
    // This file will be concatenated into the main visual test suite

    registerVisualTest('transform-basic-translate', {
        name: 'Basic translation operations',
        width: 200, height: 150,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 150);
            
            // Red square at origin
            ctx.fillStyle = 'red';
            ctx.fillRect(10, 10, 30, 30);
            
            // Translate and draw blue square
            ctx.translate(50, 20);
            ctx.fillStyle = 'blue';
            ctx.fillRect(10, 10, 30, 30);
            
            // Translate again and draw green square
            ctx.translate(60, 30);
            ctx.fillStyle = 'green';
            ctx.fillRect(10, 10, 30, 30);
        },
    });

    // Test: Basic Scaling
    // This file will be concatenated into the main visual test suite

    registerVisualTest('transform-basic-scale', {
        name: 'Basic scaling operations',
        width: 200, height: 150,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 150);
            
            // Original size red square
            ctx.fillStyle = 'red';
            ctx.fillRect(10, 10, 20, 20);
            
            // Scale 2x and draw blue square
            ctx.translate(60, 10);
            ctx.scale(2, 2);
            ctx.fillStyle = 'blue';
            ctx.fillRect(0, 0, 20, 20);
            
            // Reset, scale 0.5x and draw green square
            ctx.resetTransform();
            ctx.translate(10, 60);
            ctx.scale(0.5, 0.5);
            ctx.fillStyle = 'green';
            ctx.fillRect(0, 0, 40, 40);
        },
    });

    // Test: Basic Rotation
    // This file will be concatenated into the main visual test suite

    registerVisualTest('transform-basic-rotate', {
        name: 'Basic rotation operations',
        width: 200, height: 150,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 150);
            
            // Original red square
            ctx.fillStyle = 'red';
            ctx.fillRect(20, 20, 25, 25);
            
            // Rotate 45 degrees and draw blue square
            ctx.translate(100, 40);
            ctx.rotate(Math.PI / 4);
            ctx.fillStyle = 'blue';
            ctx.fillRect(-12, -12, 25, 25);
            
            // Reset, rotate 90 degrees and draw green square
            ctx.resetTransform();
            ctx.translate(60, 100);
            ctx.rotate(Math.PI / 2);
            ctx.fillStyle = 'green';
            ctx.fillRect(-12, -12, 25, 25);
        },
    });

    // Test: setTransform vs transform behavior
    // This file will be concatenated into the main visual test suite

    registerVisualTest('transform-setTransform-vs-transform', {
        name: 'setTransform vs transform behavior comparison',
        width: 250, height: 150,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 250, 150);
            
            // Left side: Using transform() - accumulative
            ctx.fillStyle = 'red';
            ctx.transform(1, 0, 0, 1, 20, 20); // translate(20, 20)
            ctx.fillRect(0, 0, 20, 20);
            
            ctx.transform(2, 0, 0, 2, 0, 0); // scale(2, 2) - accumulative
            ctx.fillStyle = 'green';
            ctx.fillRect(15, 0, 15, 15);
            
            // Right side: Using setTransform() - absolute
            ctx.setTransform(1, 0, 0, 1, 150, 20); // absolute translate(150, 20)
            ctx.fillStyle = 'blue';
            ctx.fillRect(0, 0, 20, 20);
            
            ctx.setTransform(2, 0, 0, 2, 150, 60); // absolute scale + translate
            ctx.fillStyle = 'magenta';
            ctx.fillRect(0, 0, 15, 15);
        },
    });

    // Test: resetTransform functionality
    // This file will be concatenated into the main visual test suite

    registerVisualTest('transform-resetTransform', {
        name: 'resetTransform functionality',
        width: 200, height: 150,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 150);
            
            // Apply complex transform
            ctx.translate(50, 30);
            ctx.rotate(Math.PI / 6);
            ctx.scale(1.5, 1.5);
            
            // Draw transformed red square
            ctx.fillStyle = 'red';
            ctx.fillRect(0, 0, 20, 20);
            
            // Reset transform and draw blue square at origin
            ctx.resetTransform();
            ctx.fillStyle = 'blue';
            ctx.fillRect(10, 80, 20, 20);
            
            // Apply new transform after reset
            ctx.translate(120, 50);
            ctx.scale(0.8, 0.8);
            ctx.fillStyle = 'green';
            ctx.fillRect(0, 0, 25, 25);
        },
    });

    // Test: Transform state save/restore
    // This file will be concatenated into the main visual test suite

    registerVisualTest('transform-state-save-restore', {
        name: 'Transform with save/restore stack',
        width: 200, height: 150,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 150);
            
            // Initial transform
            ctx.translate(30, 30);
            ctx.scale(1.2, 1.2);
            
            // Draw red square with initial transform
            ctx.fillStyle = 'red';
            ctx.fillRect(0, 0, 20, 20);
            
            // Save state, apply additional transform
            ctx.save();
            ctx.rotate(Math.PI / 4);
            ctx.translate(40, 0);
            
            // Draw blue square with combined transforms
            ctx.fillStyle = 'blue';
            ctx.fillRect(0, 0, 15, 15);
            
            // Restore to saved state, draw green square
            ctx.restore();
            ctx.translate(0, 40);
            ctx.fillStyle = 'green';
            ctx.fillRect(0, 0, 18, 18);
        },
    });

    // Test: Combined transform operations
    // This file will be concatenated into the main visual test suite

    registerVisualTest('transform-combined-operations', {
        name: 'Multiple transforms combined',
        width: 200, height: 150,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 150);
            
            // Complex combined transform: translate + rotate + scale
            ctx.translate(100, 75);
            ctx.rotate(Math.PI / 6);
            ctx.scale(1.5, 0.8);
            ctx.translate(-15, -10);
            
            // Draw transformed rectangle
            ctx.fillStyle = 'orange';
            ctx.fillRect(0, 0, 30, 20);
            
            // Draw border to show original position
            ctx.resetTransform();
            ctx.strokeStyle = 'gray';
            ctx.lineWidth = 1;
            ctx.strokeRect(85, 65, 30, 20);
        },
    });

    // Test: Transform matrix order dependency (A*B ≠ B*A)
    // This file will be concatenated into the main visual test suite

    registerVisualTest('transform-matrix-order', {
        name: 'Transform order dependency (A*B ≠ B*A)',
        width: 200, height: 150,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 150);
            
            // Square 1: Translate(40,40) THEN Scale(2,2) - Red
            ctx.save();
            ctx.translate(40, 40);
            ctx.scale(2, 2);
            ctx.fillStyle = 'red';
            ctx.fillRect(0, 0, 15, 15);
            ctx.restore();
            
            // Square 2: Scale(2,2) THEN Translate(60,60) - Blue  
            ctx.save();
            ctx.scale(2, 2);
            ctx.translate(60, 60);
            ctx.fillStyle = 'blue';
            ctx.fillRect(0, 0, 15, 15);
            ctx.restore();
        },
    });

    // Test: fill-concave-polygons - Star shapes and L-shapes
    // This file will be concatenated into the main visual test suite

    registerVisualTest('fill-concave-polygons', {
        name: 'Concave polygon filling (star and L-shape)',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            // Draw a 5-pointed star (concave polygon)
            ctx.beginPath();
            ctx.fillStyle = 'red';
            const centerX = 75, centerY = 75;
            const outerRadius = 40, innerRadius = 16;
            
            for (let i = 0; i < 10; i++) {
                const angle = (i * Math.PI) / 5;
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            ctx.fill();
            
            // Draw an L-shape (concave polygon)
            ctx.beginPath();
            ctx.fillStyle = 'blue';
            ctx.moveTo(160, 40);
            ctx.lineTo(220, 40);
            ctx.lineTo(220, 70);
            ctx.lineTo(190, 70);
            ctx.lineTo(190, 120);
            ctx.lineTo(160, 120);
            ctx.closePath();
            ctx.fill();
            
            // Draw a more complex concave shape (arrow-like)
            ctx.beginPath();
            ctx.fillStyle = 'green';
            ctx.moveTo(50, 140);
            ctx.lineTo(90, 140);
            ctx.lineTo(90, 130);
            ctx.lineTo(110, 150);
            ctx.lineTo(90, 170);
            ctx.lineTo(90, 160);
            ctx.lineTo(50, 160);
            ctx.closePath();
            ctx.fill();
        },
    });

    // Test: fill-self-intersecting - Self-intersecting paths
    // This file will be concatenated into the main visual test suite

    registerVisualTest('fill-self-intersecting', {
        name: 'Self-intersecting path filling',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            // Self-intersecting bowtie shape
            ctx.beginPath();
            ctx.fillStyle = 'red';
            ctx.moveTo(50, 50);
            ctx.lineTo(130, 50);
            ctx.lineTo(50, 100);
            ctx.lineTo(130, 100);
            ctx.closePath();
            ctx.fill();
            
            // Figure-8 like self-intersection
            ctx.beginPath();
            ctx.fillStyle = 'blue';
            ctx.moveTo(180, 40);
            ctx.lineTo(220, 80);
            ctx.lineTo(260, 40);
            ctx.lineTo(220, 100);
            ctx.lineTo(260, 140);
            ctx.lineTo(220, 100);
            ctx.lineTo(180, 140);
            ctx.lineTo(220, 80);
            ctx.closePath();
            ctx.fill();
            
            // Complex self-intersecting star-like shape
            ctx.beginPath();
            ctx.fillStyle = 'green';
            ctx.moveTo(90, 140);
            ctx.lineTo(50, 180);
            ctx.lineTo(110, 160);
            ctx.lineTo(70, 190);
            ctx.lineTo(130, 170);
            ctx.lineTo(90, 200);
            ctx.lineTo(150, 180);
            ctx.lineTo(110, 210);
            ctx.closePath();
            ctx.fill();
        },
    });

    // Test: fill-nested-holes - Paths with holes
    // This file will be concatenated into the main visual test suite

    registerVisualTest('fill-nested-holes', {
        name: 'Path filling with nested holes',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            // Outer rectangle with hole using even-odd rule
            ctx.beginPath();
            ctx.fillStyle = 'red';
            // Outer rectangle
            ctx.rect(30, 30, 100, 80);
            // Inner hole (reverse winding for even-odd)
            ctx.rect(50, 50, 60, 40);
            ctx.fill('evenodd');
            
            // Nested squares with holes
            ctx.beginPath();
            ctx.fillStyle = 'blue';
            // Outermost square
            ctx.rect(160, 20, 120, 120);
            // Middle hole
            ctx.rect(180, 40, 80, 80);
            // Inner filled square (creates hole in the hole)
            ctx.rect(200, 60, 40, 40);
            ctx.fill('evenodd');
            
            // Complex donut shape with inner hole
            ctx.beginPath();
            ctx.fillStyle = 'green';
            // Outer circle approximated by octagon
            const cx = 100, cy = 170, outerR = 35, innerR = 15;
            for (let i = 0; i < 8; i++) {
                const angle = (i * Math.PI) / 4;
                const x = cx + Math.cos(angle) * outerR;
                const y = cy + Math.sin(angle) * outerR;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            
            // Inner hole (octagon)
            for (let i = 0; i < 8; i++) {
                const angle = (i * Math.PI) / 4;
                const x = cx + Math.cos(angle) * innerR;
                const y = cy + Math.sin(angle) * innerR;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill('evenodd');
        },
    });

    // Test: fill-multiple-subpaths - Multiple subpath handling
    // This file will be concatenated into the main visual test suite

    registerVisualTest('fill-multiple-subpaths', {
        name: 'Multiple subpath handling',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            // Multiple disconnected subpaths in one fill call
            ctx.beginPath();
            ctx.fillStyle = 'red';
            
            // First subpath - triangle
            ctx.moveTo(40, 40);
            ctx.lineTo(80, 40);
            ctx.lineTo(60, 70);
            ctx.closePath();
            
            // Second subpath - rectangle (not connected)
            ctx.moveTo(100, 30);
            ctx.lineTo(140, 30);
            ctx.lineTo(140, 80);
            ctx.lineTo(100, 80);
            ctx.closePath();
            
            // Third subpath - pentagon
            ctx.moveTo(170, 40);
            ctx.lineTo(190, 30);
            ctx.lineTo(210, 50);
            ctx.lineTo(200, 80);
            ctx.lineTo(160, 80);
            ctx.closePath();
            
            ctx.fill();
            
            // Multiple subpaths with different fill rules
            ctx.beginPath();
            ctx.fillStyle = 'blue';
            
            // Outer shape
            ctx.moveTo(50, 120);
            ctx.lineTo(130, 120);
            ctx.lineTo(130, 180);
            ctx.lineTo(50, 180);
            ctx.closePath();
            
            // Inner hole (same winding - will create hole with evenodd)
            ctx.moveTo(70, 140);
            ctx.lineTo(110, 140);
            ctx.lineTo(110, 160);
            ctx.lineTo(70, 160);
            ctx.closePath();
            
            // Small separate rectangle
            ctx.moveTo(160, 130);
            ctx.lineTo(180, 130);
            ctx.lineTo(180, 150);
            ctx.lineTo(160, 150);
            ctx.closePath();
            
            ctx.fill('evenodd');
            
            // Mixed open and closed subpaths (only closed ones should fill)
            ctx.beginPath();
            ctx.fillStyle = 'green';
            
            // Open subpath (should not fill)
            ctx.moveTo(200, 120);
            ctx.lineTo(220, 130);
            ctx.lineTo(240, 120);
            
            // Closed subpath (should fill)
            ctx.moveTo(210, 150);
            ctx.lineTo(250, 150);
            ctx.lineTo(230, 180);
            ctx.closePath();
            
            ctx.fill();
        },
    });

    // Test: fill-bezier-curves - Cubic bezier curve filling
    // This file will be concatenated into the main visual test suite

    registerVisualTest('fill-bezier-curves', {
        name: 'Cubic bezier curve filling',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            // Simple curved shape with bezier curves
            ctx.beginPath();
            ctx.fillStyle = 'red';
            ctx.moveTo(50, 50);
            ctx.bezierCurveTo(50, 20, 100, 20, 100, 50);
            ctx.bezierCurveTo(130, 50, 130, 100, 100, 100);
            ctx.bezierCurveTo(100, 130, 50, 130, 50, 100);
            ctx.bezierCurveTo(20, 100, 20, 50, 50, 50);
            ctx.closePath();
            ctx.fill();
            
            // Heart-like shape using bezier curves
            ctx.beginPath();
            ctx.fillStyle = 'magenta';
            ctx.moveTo(200, 80);
            // Left side of heart
            ctx.bezierCurveTo(200, 60, 180, 50, 170, 60);
            ctx.bezierCurveTo(160, 70, 160, 85, 200, 120);
            // Right side of heart
            ctx.bezierCurveTo(240, 85, 240, 70, 230, 60);
            ctx.bezierCurveTo(220, 50, 200, 60, 200, 80);
            ctx.closePath();
            ctx.fill();
            
            // Complex curved path with multiple bezier segments
            ctx.beginPath();
            ctx.fillStyle = 'lightblue';
            ctx.moveTo(50, 160);
            ctx.bezierCurveTo(80, 140, 120, 140, 150, 160);
            ctx.bezierCurveTo(150, 180, 120, 200, 100, 180);
            ctx.bezierCurveTo(80, 200, 50, 180, 50, 160);
            ctx.closePath();
            ctx.fill();
            
            // Leaf-like shape
            ctx.beginPath();
            ctx.fillStyle = 'green';
            ctx.moveTo(220, 160);
            ctx.bezierCurveTo(240, 140, 260, 140, 270, 160);
            ctx.bezierCurveTo(270, 170, 260, 180, 250, 185);
            ctx.bezierCurveTo(240, 190, 230, 185, 220, 180);
            ctx.bezierCurveTo(210, 175, 210, 165, 220, 160);
            ctx.closePath();
            ctx.fill();
        },
    });

    // Test: fill-quadratic-curves - Quadratic curve filling
    // This file will be concatenated into the main visual test suite

    registerVisualTest('fill-quadratic-curves', {
        name: 'Quadratic curve filling',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            // Simple curved shape with quadratic curves
            ctx.beginPath();
            ctx.fillStyle = 'red';
            ctx.moveTo(50, 80);
            ctx.quadraticCurveTo(75, 40, 100, 80);
            ctx.quadraticCurveTo(100, 120, 50, 120);
            ctx.quadraticCurveTo(25, 100, 50, 80);
            ctx.closePath();
            ctx.fill();
            
            // Petal-like shapes
            ctx.beginPath();
            ctx.fillStyle = 'magenta';
            ctx.moveTo(150, 60);
            ctx.quadraticCurveTo(180, 30, 210, 60);
            ctx.quadraticCurveTo(180, 90, 150, 60);
            ctx.closePath();
            ctx.fill();
            
            ctx.beginPath();
            ctx.moveTo(180, 80);
            ctx.quadraticCurveTo(210, 50, 240, 80);
            ctx.quadraticCurveTo(210, 110, 180, 80);
            ctx.closePath();
            ctx.fill();
            
            // Wave-like shape
            ctx.beginPath();
            ctx.fillStyle = 'blue';
            ctx.moveTo(30, 150);
            ctx.quadraticCurveTo(60, 130, 90, 150);
            ctx.quadraticCurveTo(120, 170, 150, 150);
            ctx.quadraticCurveTo(120, 180, 90, 170);
            ctx.quadraticCurveTo(60, 180, 30, 160);
            ctx.closePath();
            ctx.fill();
        },
    });

    // Test: fill-arcs-ellipses - Arc and ellipse filling
    // This file will be concatenated into the main visual test suite

    registerVisualTest('fill-arcs-ellipses', {
        name: 'Arc and ellipse filling',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            // Full circle using arc
            ctx.beginPath();
            ctx.fillStyle = 'red';
            ctx.arc(75, 75, 30, 0, 2 * Math.PI);
            ctx.closePath();
            ctx.fill();
            
            // Half circle (semicircle)
            ctx.beginPath();
            ctx.fillStyle = 'green';
            ctx.arc(180, 75, 25, 0, Math.PI);
            ctx.closePath();
            ctx.fill();
            
            // Quarter circle (pie slice)
            ctx.beginPath();
            ctx.fillStyle = 'blue';
            ctx.moveTo(250, 75);
            ctx.arc(250, 75, 30, 0, Math.PI / 2);
            ctx.closePath();
            ctx.fill();
            
            // Pac-Man like shape (3/4 circle)
            ctx.beginPath();
            ctx.fillStyle = 'yellow';
            ctx.moveTo(75, 150);
            ctx.arc(75, 150, 30, Math.PI / 4, 7 * Math.PI / 4);
            ctx.closePath();
            ctx.fill();
            
            // Crescent moon (overlapping circles)
            ctx.beginPath();
            ctx.fillStyle = 'lightblue';
            ctx.arc(180, 150, 25, 0, 2 * Math.PI);
            ctx.arc(190, 150, 20, 0, 2 * Math.PI);
            ctx.fill('evenodd');
        },
    });

    // Test: fill-mixed-paths - Linear + curve combinations
    // This file will be concatenated into the main visual test suite

    registerVisualTest('fill-mixed-paths', {
        name: 'Mixed linear and curve paths',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            // Shape mixing lines and curves
            ctx.beginPath();
            ctx.fillStyle = 'red';
            ctx.moveTo(50, 50);
            ctx.lineTo(100, 40);
            ctx.quadraticCurveTo(120, 60, 100, 80);
            ctx.lineTo(80, 90);
            ctx.bezierCurveTo(60, 100, 40, 90, 30, 70);
            ctx.arc(50, 50, 20, Math.PI, 3 * Math.PI / 2);
            ctx.closePath();
            ctx.fill();
            
            // House with curved roof
            ctx.beginPath();
            ctx.fillStyle = 'lightblue';
            ctx.moveTo(150, 120);
            ctx.lineTo(150, 80);
            ctx.quadraticCurveTo(175, 60, 200, 80);
            ctx.lineTo(200, 120);
            ctx.closePath();
            ctx.fill();
            
            // Flower-like shape
            ctx.beginPath();
            ctx.fillStyle = 'magenta';
            ctx.moveTo(250, 80);
            // Petal 1
            ctx.quadraticCurveTo(270, 60, 280, 80);
            ctx.lineTo(260, 90);
            // Petal 2  
            ctx.quadraticCurveTo(280, 100, 260, 120);
            ctx.lineTo(250, 100);
            // Petal 3
            ctx.quadraticCurveTo(230, 120, 220, 100);
            ctx.lineTo(240, 90);
            // Petal 4
            ctx.quadraticCurveTo(220, 80, 240, 60);
            ctx.closePath();
            ctx.fill();
            
            // Wave with straight segments
            ctx.beginPath();
            ctx.fillStyle = 'green';
            ctx.moveTo(30, 160);
            ctx.lineTo(60, 160);
            ctx.quadraticCurveTo(75, 140, 90, 160);
            ctx.lineTo(120, 160);
            ctx.quadraticCurveTo(135, 180, 150, 160);
            ctx.lineTo(180, 160);
            ctx.lineTo(180, 180);
            ctx.lineTo(30, 180);
            ctx.closePath();
            ctx.fill();
        },
    });

    // Test: fill-rule-complex - Complex even-odd vs nonzero comparisons
    // This file will be concatenated into the main visual test suite

    registerVisualTest('fill-rule-complex', {
        name: 'Complex fill rule comparisons (even-odd vs nonzero)',
        width: 400, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 400, 200);
            
            // Left side: nonzero fill rule
            ctx.beginPath();
            ctx.fillStyle = 'red';
            
            // Outer rectangle
            ctx.rect(20, 20, 160, 80);
            // Inner rectangle (same winding direction)
            ctx.rect(60, 40, 80, 40);
            
            // Fill with nonzero rule (default)
            ctx.fill('nonzero');
            
            // Right side: evenodd fill rule
            ctx.beginPath();
            ctx.fillStyle = 'blue';
            
            // Same shapes, different fill rule
            ctx.rect(220, 20, 160, 80);
            ctx.rect(260, 40, 80, 40);
            
            // Fill with evenodd rule
            ctx.fill('evenodd');
            
            // Complex overlapping shapes - nonzero
            ctx.beginPath();
            ctx.fillStyle = 'green';
            
            // Star with overlapping triangles
            const cx = 100, cy = 150;
            // Outer points
            for (let i = 0; i < 5; i++) {
                const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                const x = cx + Math.cos(angle) * 30;
                const y = cy + Math.sin(angle) * 30;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            
            // Inner pentagon (reverse winding)
            for (let i = 4; i >= 0; i--) {
                const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                const x = cx + Math.cos(angle) * 12;
                const y = cy + Math.sin(angle) * 12;
                if (i === 4) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            
            ctx.fill('nonzero');
            
            // Same complex shape - evenodd
            ctx.beginPath();
            ctx.fillStyle = 'magenta';
            
            const cx2 = 300, cy2 = 150;
            // Outer points
            for (let i = 0; i < 5; i++) {
                const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                const x = cx2 + Math.cos(angle) * 30;
                const y = cy2 + Math.sin(angle) * 30;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            
            // Inner pentagon (same winding as outer)
            for (let i = 0; i < 5; i++) {
                const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                const x = cx2 + Math.cos(angle) * 12;
                const y = cy2 + Math.sin(angle) * 12;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            
            ctx.fill('evenodd');
        }
    });

    // Test: Basic rectangular clip regions
    // This file will be concatenated into the main visual test suite

    registerVisualTest('clip-rectangular', {
        name: 'Basic Rectangular Clipping',
        width: 400,
        height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            // No need for clearRect with SWCanvas as it starts clean
            
            // Left side: No clipping
            ctx.fillStyle = 'lightblue';
            ctx.fillRect(10, 10, 80, 60);
            ctx.fillStyle = 'red';
            ctx.fillRect(30, 30, 80, 60);
            
            // Right side: With rectangular clipping
            ctx.save();
            ctx.beginPath();
            ctx.rect(150, 20, 60, 40);
            ctx.clip();
            
            ctx.fillStyle = 'lightblue';
            ctx.fillRect(130, 10, 80, 60);
            ctx.fillStyle = 'red';
            ctx.fillRect(150, 30, 80, 60);
            ctx.restore();
            
            // Bottom: Multiple overlapping rectangles with clip
            ctx.save();
            ctx.beginPath();
            ctx.rect(50, 120, 100, 50);
            ctx.clip();
            
            ctx.fillStyle = 'green';
            ctx.fillRect(20, 100, 60, 80);
            ctx.fillStyle = 'orange';
            ctx.fillRect(80, 110, 60, 80);
            ctx.fillStyle = 'purple';
            ctx.fillRect(40, 140, 60, 50);
            ctx.restore();
        },
    });

    // Test: Polygon clip shapes
    // This file will be concatenated into the main visual test suite

    registerVisualTest('clip-polygon', {
        name: 'Polygon Clipping',
        width: 400,
        height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Left: Triangle clip region
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(50, 20);
            ctx.lineTo(120, 20);
            ctx.lineTo(85, 80);
            ctx.closePath();
            ctx.clip();
            
            ctx.fillStyle = 'lightblue';
            ctx.fillRect(20, 10, 100, 80);
            ctx.fillStyle = 'red';
            ctx.fillRect(60, 30, 60, 60);
            ctx.restore();
            
            // Center: Diamond clip region
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(200, 20);
            ctx.lineTo(240, 50);
            ctx.lineTo(200, 80);
            ctx.lineTo(160, 50);
            ctx.closePath();
            ctx.clip();
            
            ctx.fillStyle = 'green';
            ctx.fillRect(140, 10, 120, 80);
            ctx.fillStyle = 'orange';
            ctx.fillRect(180, 40, 60, 40);
            ctx.restore();
            
            // Right: Star clip region
            // NOTE: Some browsers may show a thin outline around clip regions.
            // This is non-standard behavior - Chrome and SWCanvas correctly don't stroke clip paths.
            // The HTML5 Canvas spec does not require stroking of clip boundaries.
            ctx.save();
            ctx.beginPath();
            const cx = 340, cy = 50;
            // Outer star points
            for (let i = 0; i < 5; i++) {
                const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                const x = cx + Math.cos(angle) * 30;
                const y = cy + Math.sin(angle) * 30;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
                
                // Inner points
                const innerAngle = angle + Math.PI / 5;
                const ix = cx + Math.cos(innerAngle) * 12;
                const iy = cy + Math.sin(innerAngle) * 12;
                ctx.lineTo(ix, iy);
            }
            ctx.closePath();
            ctx.clip();
            
            ctx.fillStyle = 'purple';
            ctx.fillRect(300, 10, 80, 80);
            ctx.fillStyle = 'yellow';
            ctx.fillRect(320, 30, 40, 40);
            ctx.restore();
            
            // Bottom: Hexagon clip with multiple fills
            ctx.save();
            ctx.beginPath();
            const hx = 200, hy = 150;
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI) / 3;
                const x = hx + Math.cos(angle) * 40;
                const y = hy + Math.sin(angle) * 40;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.clip();
            
            ctx.fillStyle = 'cyan';
            ctx.fillRect(140, 100, 120, 100);
            ctx.fillStyle = 'magenta';
            ctx.fillRect(180, 130, 40, 40);
            ctx.fillStyle = 'lime';
            ctx.fillRect(160, 120, 80, 20);
            ctx.restore();
        },
    });

    // Test: Arc/ellipse clip regions
    // This file will be concatenated into the main visual test suite

    registerVisualTest('clip-curved', {
        name: 'Curved Clipping',
        width: 400,
        height: 250,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Left: Circle clip region
            ctx.save();
            ctx.beginPath();
            ctx.arc(80, 60, 40, 0, 2 * Math.PI);
            ctx.clip();
            
            ctx.fillStyle = 'lightblue';
            ctx.fillRect(20, 20, 120, 80);
            ctx.fillStyle = 'red';
            ctx.fillRect(50, 40, 60, 40);
            ctx.restore();
            
            // Center: Ellipse clip region
            ctx.save();
            ctx.beginPath();
            ctx.arc(200, 60, 40, 0, 2 * Math.PI);
            ctx.clip();
            
            ctx.fillStyle = 'green';
            ctx.fillRect(130, 20, 140, 80);
            ctx.fillStyle = 'orange';
            ctx.fillRect(170, 45, 60, 30);
            ctx.restore();
            
            // Right: Arc clip region (partial circle)
            ctx.save();
            ctx.beginPath();
            ctx.arc(340, 60, 35, 0, Math.PI);
            ctx.lineTo(305, 60);
            ctx.closePath();
            ctx.clip();
            
            ctx.fillStyle = 'purple';
            ctx.fillRect(280, 20, 120, 80);
            ctx.fillStyle = 'yellow';
            ctx.fillRect(320, 30, 40, 60);
            ctx.restore();
            
            // Bottom left: Rotated ellipse
            ctx.save();
            ctx.beginPath();
            ctx.arc(100, 180, 30, 0, 2 * Math.PI);
            ctx.clip();
            
            ctx.fillStyle = 'cyan';
            ctx.fillRect(40, 140, 120, 80);
            ctx.fillStyle = 'magenta';
            ctx.fillRect(80, 160, 40, 40);
            ctx.restore();
            
            // Bottom right: Complex arc path
            ctx.save();
            ctx.beginPath();
            ctx.arc(300, 180, 30, 0, Math.PI / 2);
            ctx.arc(350, 180, 30, Math.PI / 2, Math.PI);
            ctx.arc(350, 210, 30, Math.PI, 3 * Math.PI / 2);
            ctx.arc(300, 210, 30, 3 * Math.PI / 2, 0);
            ctx.closePath();
            ctx.clip();
            
            ctx.fillStyle = 'lime';
            ctx.fillRect(250, 140, 130, 90);
            ctx.fillStyle = 'navy';
            ctx.fillRect(280, 170, 70, 30);
            ctx.restore();
        },
    });

    // Test: Self-intersecting clip paths
    // This file will be concatenated into the main visual test suite

    registerVisualTest('clip-self-intersecting', {
        name: 'Self-Intersecting Clipping',
        width: 400,
        height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Left: Figure-8 clip path
            ctx.save();
            ctx.beginPath();
            ctx.arc(70, 50, 30, 0, 2 * Math.PI);
            ctx.arc(110, 50, 30, 0, 2 * Math.PI);
            ctx.clip();
            
            ctx.fillStyle = 'lightblue';
            ctx.fillRect(20, 20, 120, 60);
            ctx.fillStyle = 'red';
            ctx.fillRect(60, 35, 60, 30);
            ctx.restore();
            
            // Center: Self-intersecting star
            ctx.save();
            ctx.beginPath();
            const cx = 200, cy = 50;
            // Create self-intersecting star
            for (let i = 0; i < 5; i++) {
                const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
                const x = cx + Math.cos(angle) * 40;
                const y = cy + Math.sin(angle) * 40;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.clip();
            
            ctx.fillStyle = 'green';
            ctx.fillRect(140, 10, 120, 80);
            ctx.fillStyle = 'orange';
            ctx.fillRect(180, 30, 40, 40);
            ctx.restore();
            
            // Right: Bow-tie/hourglass shape
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(290, 20);
            ctx.lineTo(350, 80);
            ctx.lineTo(370, 20);
            ctx.lineTo(330, 50);
            ctx.lineTo(370, 80);
            ctx.lineTo(290, 80);
            ctx.lineTo(310, 20);
            ctx.closePath();
            ctx.clip();
            
            ctx.fillStyle = 'purple';
            ctx.fillRect(270, 10, 120, 80);
            ctx.fillStyle = 'yellow';
            ctx.fillRect(300, 35, 60, 30);
            ctx.restore();
            
            // Bottom: Complex self-intersecting polygon
            ctx.save();
            ctx.beginPath();
            const points = [
                [50, 130], [120, 160], [80, 120], [150, 150], [90, 180],
                [130, 110], [60, 170], [140, 140], [70, 110], [110, 190]
            ];
            ctx.moveTo(points[0][0], points[0][1]);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i][0], points[i][1]);
            }
            ctx.closePath();
            ctx.clip();
            
            ctx.fillStyle = 'cyan';
            ctx.fillRect(30, 100, 140, 100);
            ctx.fillStyle = 'magenta';
            ctx.fillRect(70, 130, 60, 40);
            ctx.restore();
            
            // Bottom right: Spiral-like intersecting path
            ctx.save();
            ctx.beginPath();
            const spiralCx = 300, spiralCy = 150;
            for (let t = 0; t < 4 * Math.PI; t += 0.5) {
                const r = 5 + t * 3;
                const x = spiralCx + r * Math.cos(t);
                const y = spiralCy + r * Math.sin(t);
                if (t === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            // Connect back to create intersections
            ctx.lineTo(spiralCx + 20, spiralCy - 20);
            ctx.lineTo(spiralCx - 30, spiralCy + 30);
            ctx.closePath();
            ctx.clip();
            
            ctx.fillStyle = 'lime';
            ctx.fillRect(220, 110, 160, 80);
            ctx.fillStyle = 'navy';
            ctx.fillRect(270, 130, 60, 40);
            ctx.restore();
        },
    });

    // Test: Multiple nested clips
    // This file will be concatenated into the main visual test suite

    registerVisualTest('clip-stack-nested', {
        name: 'Nested Clipping Stack',
        width: 400,
        height: 250,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Left: Two nested rectangular clips
            ctx.save();
            // First clip: large rectangle
            ctx.beginPath();
            ctx.rect(20, 20, 120, 80);
            ctx.clip();
            
            ctx.fillStyle = 'lightblue';
            ctx.fillRect(0, 0, 160, 120);
            
            ctx.save();
            // Second clip: smaller rectangle inside first
            ctx.beginPath();
            ctx.rect(40, 40, 60, 40);
            ctx.clip();
            
            ctx.fillStyle = 'red';
            ctx.fillRect(20, 20, 100, 80);
            ctx.restore();
            
            // After restore, only first clip applies
            ctx.fillStyle = 'green';
            ctx.fillRect(100, 50, 40, 30);
            ctx.restore();
            
            // Center: Circle then triangle clips
            ctx.save();
            // First clip: circle
            ctx.beginPath();
            ctx.arc(200, 60, 40, 0, 2 * Math.PI);
            ctx.clip();
            
            ctx.fillStyle = 'orange';
            ctx.fillRect(140, 20, 120, 80);
            
            ctx.save();
            // Second clip: triangle inside circle
            ctx.beginPath();
            ctx.moveTo(180, 30);
            ctx.lineTo(220, 30);
            ctx.lineTo(200, 70);
            ctx.closePath();
            ctx.clip();
            
            ctx.fillStyle = 'purple';
            ctx.fillRect(160, 20, 80, 80);
            ctx.restore();
            
            // Back to circle clip only
            ctx.fillStyle = 'yellow';
            ctx.fillRect(185, 75, 30, 20);
            ctx.restore();
            
            // Right: Three nested clips
            ctx.save();
            // First clip: large rectangle
            ctx.beginPath();
            ctx.rect(280, 20, 100, 80);
            ctx.clip();
            
            ctx.fillStyle = 'cyan';
            ctx.fillRect(260, 0, 140, 120);
            
            ctx.save();
            // Second clip: circle inside rectangle
            ctx.beginPath();
            ctx.arc(330, 60, 35, 0, 2 * Math.PI);
            ctx.clip();
            
            ctx.fillStyle = 'magenta';
            ctx.fillRect(300, 30, 60, 60);
            
            ctx.save();
            // Third clip: small rectangle inside circle
            ctx.beginPath();
            ctx.rect(315, 45, 30, 30);
            ctx.clip();
            
            ctx.fillStyle = 'lime';
            ctx.fillRect(310, 40, 40, 40);
            ctx.restore(); // Back to circle + rectangle
            
            ctx.fillStyle = 'navy';
            ctx.fillRect(305, 35, 50, 15);
            ctx.restore(); // Back to rectangle only
            
            ctx.fillStyle = 'maroon';
            ctx.fillRect(285, 85, 90, 10);
            ctx.restore(); // No clips
            
            // Bottom: Complex nested polygon clips
            ctx.save();
            // First clip: hexagon
            ctx.beginPath();
            const hx = 120, hy = 170;
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI) / 3;
                const x = hx + Math.cos(angle) * 50;
                const y = hy + Math.sin(angle) * 50;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.clip();
            
            ctx.fillStyle = 'lightcoral';
            ctx.fillRect(50, 110, 140, 120);
            
            ctx.save();
            // Second clip: diamond inside hexagon
            ctx.beginPath();
            ctx.moveTo(120, 140);
            ctx.lineTo(150, 170);
            ctx.lineTo(120, 200);
            ctx.lineTo(90, 170);
            ctx.closePath();
            ctx.clip();
            
            ctx.fillStyle = 'darkblue';
            ctx.fillRect(70, 130, 100, 80);
            
            ctx.save();
            // Third clip: small circle in center
            ctx.beginPath();
            ctx.arc(120, 170, 15, 0, 2 * Math.PI);
            ctx.clip();
            
            ctx.fillStyle = 'gold';
            ctx.fillRect(100, 150, 40, 40);
            ctx.restore(); // Back to diamond + hexagon
            
            ctx.fillStyle = 'silver';
            ctx.fillRect(105, 155, 30, 10);
            ctx.restore(); // Back to hexagon only
            
            ctx.fillStyle = 'darkgreen';
            ctx.fillRect(140, 145, 25, 50);
            ctx.restore(); // No clips
            
            // Bottom right: Clip stack with transforms
            ctx.save();
            ctx.translate(280, 150);
            ctx.rotate(Math.PI / 6);
            
            // First clip: rotated rectangle
            ctx.beginPath();
            ctx.rect(-40, -30, 80, 60);
            ctx.clip();
            
            ctx.fillStyle = 'pink';
            ctx.fillRect(-60, -50, 120, 100);
            
            ctx.save();
            ctx.scale(0.7, 0.7);
            // Second clip: scaled circle
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, 2 * Math.PI);
            ctx.clip();
            
            ctx.fillStyle = 'brown';
            ctx.fillRect(-40, -40, 80, 80);
            ctx.restore();
            
            ctx.fillStyle = 'indigo';
            ctx.fillRect(-15, -35, 30, 15);
            ctx.restore();
        },
    });

    // Test: Clip with save/restore behavior
    // This file will be concatenated into the main visual test suite

    registerVisualTest('clip-save-restore', {
        name: 'Clipping Save/Restore',
        width: 400,
        height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Left: Basic save/restore with clip
            ctx.fillStyle = 'lightgray';
            ctx.fillRect(10, 10, 80, 80);
            
            ctx.save();
            ctx.beginPath();
            ctx.rect(20, 20, 60, 60);
            ctx.clip();
            
            ctx.fillStyle = 'red';
            ctx.fillRect(0, 0, 100, 100);
            ctx.restore();
            
            // Should not be clipped after restore
            ctx.fillStyle = 'blue';
            ctx.fillRect(30, 85, 40, 15);
            
            // Center: Multiple save/restore levels
            ctx.save();
            ctx.fillStyle = 'lightblue';
            ctx.fillRect(120, 10, 80, 80);
            
            ctx.save();
            ctx.beginPath();
            ctx.rect(130, 20, 60, 40);
            ctx.clip();
            
            ctx.fillStyle = 'green';
            ctx.fillRect(110, 10, 100, 80);
            
            ctx.save();
            ctx.beginPath();
            ctx.rect(140, 30, 40, 20);
            ctx.clip();
            
            ctx.fillStyle = 'yellow';
            ctx.fillRect(120, 20, 80, 60);
            ctx.restore(); // Back to first clip
            
            ctx.fillStyle = 'orange';
            ctx.fillRect(135, 65, 30, 15);
            ctx.restore(); // Back to no clips
            
            ctx.fillStyle = 'purple';
            ctx.fillRect(125, 85, 70, 10);
            ctx.restore(); // Back to original state
            
            // Right: Clip with transform save/restore
            ctx.save();
            ctx.translate(280, 50);
            ctx.rotate(Math.PI / 4);
            
            ctx.beginPath();
            ctx.rect(-30, -30, 60, 60);
            ctx.clip();
            
            ctx.fillStyle = 'cyan';
            ctx.fillRect(-50, -50, 100, 100);
            
            ctx.save();
            ctx.scale(0.5, 0.5);
            ctx.fillStyle = 'magenta';
            ctx.fillRect(-40, -40, 80, 80);
            ctx.restore(); // Back to rotated/translated but same clip
            
            ctx.fillStyle = 'lime';
            ctx.fillRect(-10, -40, 20, 80);
            ctx.restore(); // Back to original transform and no clip
            
            ctx.fillStyle = 'navy';
            ctx.fillRect(250, 85, 60, 10);
            
            // Bottom: Complex save/restore with multiple clips and fills
            ctx.save();
            // First level
            ctx.beginPath();
            ctx.arc(80, 150, 40, 0, 2 * Math.PI);
            ctx.clip();
            
            ctx.fillStyle = 'pink';
            ctx.fillRect(20, 110, 120, 80);
            
            ctx.save();
            // Second level - diamond clip
            ctx.beginPath();
            ctx.moveTo(80, 120);
            ctx.lineTo(110, 150);
            ctx.lineTo(80, 180);
            ctx.lineTo(50, 150);
            ctx.closePath();
            ctx.clip();
            
            ctx.fillStyle = 'brown';
            ctx.fillRect(40, 130, 80, 40);
            
            // Modify state without save
            ctx.fillStyle = 'gold';
            ctx.fillRect(70, 140, 20, 20);
            
            ctx.restore(); // Back to circle clip only
            
            ctx.fillStyle = 'silver';
            ctx.fillRect(60, 125, 40, 10);
            
            ctx.save();
            // Third level - small rectangle
            ctx.beginPath();
            ctx.rect(65, 160, 30, 15);
            ctx.clip();
            
            ctx.fillStyle = 'maroon';
            ctx.fillRect(50, 150, 60, 30);
            ctx.restore(); // Back to circle clip
            
            ctx.fillStyle = 'darkgreen';
            ctx.fillRect(90, 135, 25, 30);
            ctx.restore(); // Back to no clips
            
            // Should render without any clipping
            ctx.fillStyle = 'black';
            ctx.fillRect(30, 185, 100, 10);
            
            // Bottom right: Save/restore with stroke and fill
            ctx.save();
            ctx.beginPath();
            ctx.rect(220, 120, 80, 60);
            ctx.clip();
            
            ctx.fillStyle = 'lightcoral';
            ctx.fillRect(200, 100, 120, 100);
            
            ctx.strokeStyle = 'darkblue';
            ctx.lineWidth = 3;
            ctx.strokeRect(210, 110, 100, 80);
            
            ctx.save();
            ctx.beginPath();
            ctx.arc(260, 150, 25, 0, 2 * Math.PI);
            ctx.clip();
            
            ctx.fillStyle = 'yellow';
            ctx.fillRect(235, 125, 50, 50);
            
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.strokeRect(245, 135, 30, 30);
            ctx.restore();
            
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 4;
            ctx.strokeRect(225, 125, 70, 15);
            ctx.restore();
        },
    });

    // Test: Basic clipping regions  
    // This file will be concatenated into the main visual test suite

    registerVisualTest('clip-intersection', {
        name: 'Basic Clipping Regions',
        width: 400,
        height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Left: Single rectangular clip (simplified from intersection)
            ctx.save();
            // Direct rectangle clip representing the intersection area
            ctx.beginPath();
            ctx.rect(30, 50, 40, 40);
            ctx.clip();
            
            ctx.fillStyle = 'red';
            ctx.fillRect(0, 0, 120, 120);
            ctx.restore();
            
            // Center: Triangle clip region  
            ctx.save();
            // Triangle clip
            ctx.beginPath();
            ctx.moveTo(180, 90);
            ctx.lineTo(220, 90);
            ctx.lineTo(200, 50);
            ctx.closePath();
            ctx.clip();
            
            ctx.fillStyle = 'blue';
            ctx.fillRect(160, 30, 80, 80);
            ctx.restore();
            
            // Right: Diamond clip region
            ctx.save();
            // Diamond clip
            ctx.beginPath();
            ctx.moveTo(330, 40);
            ctx.lineTo(360, 70);
            ctx.lineTo(330, 100);
            ctx.lineTo(300, 70);
            ctx.closePath();
            ctx.clip();
            
            ctx.fillStyle = 'green';
            ctx.fillRect(280, 20, 100, 100);
            ctx.restore();
            
            // Bottom left: Circle clip region
            ctx.save();
            ctx.beginPath();
            ctx.arc(80, 150, 35, 0, 2 * Math.PI);
            ctx.clip();
            
            ctx.fillStyle = 'orange';
            ctx.fillRect(40, 110, 80, 80);
            ctx.restore();
            
            // Bottom center: Another circle clip
            ctx.save();
            ctx.beginPath();
            ctx.arc(200, 150, 32, 0, 2 * Math.PI);
            ctx.clip();
            
            ctx.fillStyle = 'cyan';
            ctx.fillRect(160, 110, 80, 80);
            ctx.restore();
            
            // Bottom right: Star clip region
            ctx.save();
            ctx.beginPath();
            const starCx = 330, starCy = 150;
            for (let i = 0; i < 5; i++) {
                const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                const outerX = starCx + Math.cos(angle) * 30;
                const outerY = starCy + Math.sin(angle) * 30;
                const innerAngle = angle + Math.PI / 5;
                const innerX = starCx + Math.cos(innerAngle) * 15;
                const innerY = starCy + Math.sin(innerAngle) * 15;
                
                if (i === 0) ctx.moveTo(outerX, outerY);
                else ctx.lineTo(outerX, outerY);
                ctx.lineTo(innerX, innerY);
            }
            ctx.closePath();
            ctx.clip();
            
            ctx.fillStyle = 'magenta';
            ctx.fillRect(290, 110, 80, 80);
            ctx.restore();
        },
    });

    // Test: Enhanced Clipping Intersection Test
    // This file will be concatenated into the main visual test suite

    registerVisualTest('clip-intersection-enhanced', {
        name: 'Enhanced Clipping Intersection Test',
        width: 400, height: 300,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 400, 300);
            
            // Test: Basic rectangular clip intersection (left side)
            ctx.save();
            ctx.beginPath();
            ctx.rect(50, 50, 120, 80);
            ctx.clip();
            
            ctx.save();
            ctx.beginPath();
            ctx.rect(100, 80, 120, 80);
            ctx.clip(); // This creates an intersection
            
            // Fill should only appear in the intersection
            ctx.fillStyle = 'blue';
            ctx.fillRect(0, 0, 400, 300);
            ctx.restore();
            ctx.restore();
            
            // Test: Circular and rectangular clip intersection (right side)
            ctx.save();
            ctx.beginPath();
            ctx.arc(300, 90, 60, 0, 2 * Math.PI);
            ctx.clip();
            
            ctx.save();
            ctx.beginPath();
            ctx.rect(250, 50, 100, 80);
            ctx.clip();
            
            // Fill should only appear in circle-rectangle intersection
            ctx.fillStyle = 'red';
            ctx.fillRect(0, 0, 400, 300);
            ctx.restore();
            ctx.restore();
            
            // Test: Multiple nested intersections (bottom)
            ctx.save();
            ctx.beginPath();
            ctx.rect(50, 180, 150, 100);
            ctx.clip();
            
            ctx.save();
            ctx.beginPath();
            ctx.arc(125, 230, 50, 0, 2 * Math.PI);
            ctx.clip();
            
            ctx.save();
            ctx.beginPath();
            ctx.rect(100, 200, 80, 60);
            ctx.clip();
            
            // Triple intersection
            ctx.fillStyle = 'green';
            ctx.fillRect(0, 0, 400, 300);
            ctx.restore();
            ctx.restore();
            ctx.restore();
            
            // Test: Complex polygon intersection (bottom right)
            ctx.save();
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI) / 3;
                const x = 300 + Math.cos(angle) * 40;
                const y = 230 + Math.sin(angle) * 40;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.clip();
            
            ctx.save();
            ctx.beginPath();
            ctx.rect(270, 200, 60, 60);
            ctx.clip();
            
            ctx.fillStyle = 'purple';
            ctx.fillRect(0, 0, 400, 300);
            ctx.restore();
            ctx.restore();
        }
    });

    // Test: Combined Transform + Fill + Rotate - Rotated complex polygons
    // This file will be concatenated into the main visual test suite

    registerVisualTest('combined-transform-fill-rotate', {
        name: 'Rotated complex polygons',
        width: 400, height: 300,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 400, 300);
            
            // Test: Rotated star polygon (left side)
            ctx.save();
            ctx.translate(100, 80);
            ctx.rotate(Math.PI / 6); // 30 degrees
            
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                const outerX = Math.cos(angle) * 40;
                const outerY = Math.sin(angle) * 40;
                
                if (i === 0) ctx.moveTo(outerX, outerY);
                else ctx.lineTo(outerX, outerY);
                
                // Inner points
                const innerAngle = angle + Math.PI / 5;
                const innerX = Math.cos(innerAngle) * 16;
                const innerY = Math.sin(innerAngle) * 16;
                ctx.lineTo(innerX, innerY);
            }
            ctx.closePath();
            
            ctx.fillStyle = 'red';
            ctx.fill();
            ctx.strokeStyle = 'darkred';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
            
            // Test: Rotated complex hexagon with hole (center top)
            ctx.save();
            ctx.translate(300, 80);
            ctx.rotate(-Math.PI / 4); // -45 degrees
            
            // Outer hexagon
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI) / 3;
                const x = Math.cos(angle) * 45;
                const y = Math.sin(angle) * 45;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            
            // Inner pentagon hole
            ctx.moveTo(25, 0);
            for (let i = 1; i < 5; i++) {
                const angle = (i * 2 * Math.PI) / 5;
                const x = Math.cos(angle) * 25;
                const y = Math.sin(angle) * 25;
                ctx.lineTo(x, y);
            }
            ctx.closePath();
            
            ctx.fillStyle = 'blue';
            ctx.fill('evenodd');
            ctx.strokeStyle = 'darkblue';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
            
            // Test: Multiple rotated triangles (bottom left)
            const triangleAngles = [0, Math.PI / 3, 2 * Math.PI / 3];
            triangleAngles.forEach((baseAngle, idx) => {
                ctx.save();
                ctx.translate(100, 200);
                ctx.rotate(baseAngle);
                
                ctx.beginPath();
                ctx.moveTo(0, -30);
                ctx.lineTo(-26, 15);
                ctx.lineTo(26, 15);
                ctx.closePath();
                
                const colors = ['green', 'orange', 'purple'];
                ctx.fillStyle = colors[idx];
                ctx.globalAlpha = 0.7;
                ctx.fill();
                ctx.restore();
            });
            
            // Test: Rotated spiral polygon (bottom right)
            ctx.save();
            ctx.translate(300, 200);
            ctx.rotate(Math.PI / 8);
            
            ctx.beginPath();
            let radius = 5;
            for (let angle = 0; angle < 4 * Math.PI; angle += 0.3) {
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                if (angle === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
                radius += 1.5;
            }
            
            // Close with straight line to create filled area
            ctx.lineTo(0, 0);
            ctx.closePath();
            
            ctx.fillStyle = 'teal';
            ctx.fill();
            ctx.strokeStyle = 'darkcyan';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        }
    });

    // Test: Combined Transform + Fill + Rotate - Complex 6-point star version
    // This file will be concatenated into the main visual test suite

    registerVisualTest('combined-transform-fill-rotate-v2', {
        name: 'Rotated complex polygons (6-point star)',
        width: 400, height: 300,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 400, 300);
            
            // Test: Rotated star (top left)
            ctx.save();
            ctx.translate(100, 75);
            ctx.rotate(Math.PI / 4); // 45 degrees
            
            ctx.beginPath();
            // Create 6-pointed star
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI) / 3;
                const outerRadius = 30;
                const innerRadius = 15;
                
                const outerX = Math.cos(angle) * outerRadius;
                const outerY = Math.sin(angle) * outerRadius;
                const innerAngle = angle + Math.PI / 6;
                const innerX = Math.cos(innerAngle) * innerRadius;
                const innerY = Math.sin(innerAngle) * innerRadius;
                
                if (i === 0) ctx.moveTo(outerX, outerY);
                else ctx.lineTo(outerX, outerY);
                ctx.lineTo(innerX, innerY);
            }
            ctx.closePath();
            
            ctx.fillStyle = 'red';
            ctx.fill();
            ctx.restore();
            
            // Test: Rotated self-intersecting polygon (top right)
            ctx.save();
            ctx.translate(300, 75);
            ctx.rotate(-Math.PI / 6); // -30 degrees
            
            ctx.beginPath();
            // Figure-8 shape
            ctx.moveTo(-40, -20);
            ctx.quadraticCurveTo(0, -40, 40, -20);
            ctx.quadraticCurveTo(0, 0, -40, 20);
            ctx.quadraticCurveTo(0, 40, 40, 20);
            ctx.quadraticCurveTo(0, 0, -40, -20);
            ctx.closePath();
            
            ctx.fillStyle = 'green';
            ctx.fill('evenodd');
            ctx.restore();
            
            // Test: Multiple rotated rectangles with different angles (bottom left)
            const colors = ['blue', 'orange', 'purple', 'brown'];
            const angles = [0, Math.PI/6, Math.PI/3, Math.PI/2];
            
            for (let i = 0; i < 4; i++) {
                ctx.save();
                ctx.translate(100, 200);
                ctx.rotate(angles[i]);
                
                ctx.fillStyle = colors[i];
                ctx.fillRect(-30 + i*5, -10 + i*5, 60, 20);
                ctx.restore();
            }
            
            // Test: Rotated complex path with curves (bottom right)
            ctx.save();
            ctx.translate(300, 200);
            ctx.rotate(Math.PI / 8);
            ctx.scale(0.8, 1.2);
            
            ctx.beginPath();
            ctx.moveTo(-30, -25);
            ctx.bezierCurveTo(-20, -40, 20, -40, 30, -25);
            ctx.bezierCurveTo(40, -10, 40, 10, 30, 25);
            ctx.bezierCurveTo(20, 40, -20, 40, -30, 25);
            ctx.bezierCurveTo(-40, 10, -40, -10, -30, -25);
            ctx.closePath();
            
            ctx.fillStyle = 'magenta';
            ctx.fill();
            ctx.restore();
        }
    });

    // Test: Combined Transform + Fill + Scale - Scaled paths with fill rules
    // This file will be concatenated into the main visual test suite

    registerVisualTest('combined-transform-fill-scale', {
        name: 'Scaled paths with fill rules',
        width: 400, height: 300,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 400, 300);
            
            // Test: Scaled self-intersecting path with nonzero fill rule (left top)
            ctx.save();
            ctx.translate(100, 70);
            ctx.scale(1.5, 1.0);
            
            ctx.beginPath();
            ctx.moveTo(-40, -30);
            ctx.lineTo(40, -30);
            ctx.lineTo(-40, 30);
            ctx.lineTo(40, 30);
            ctx.closePath();
            
            ctx.fillStyle = 'red';
            ctx.fill(); // nonzero (default)
            ctx.strokeStyle = 'darkred';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
            
            // Test: Same scaled path with evenodd fill rule (right top)
            ctx.save();
            ctx.translate(300, 70);
            ctx.scale(1.5, 1.0);
            
            ctx.beginPath();
            ctx.moveTo(-40, -30);
            ctx.lineTo(40, -30);
            ctx.lineTo(-40, 30);
            ctx.lineTo(40, 30);
            ctx.closePath();
            
            ctx.fillStyle = 'blue';
            ctx.fill('evenodd');
            ctx.strokeStyle = 'darkblue';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
            
            // Test: Scaled complex star with nonzero (bottom left)
            ctx.save();
            ctx.translate(100, 180);
            ctx.scale(0.8, 1.2);
            
            ctx.beginPath();
            for (let i = 0; i < 7; i++) {
                const angle = (i * 2 * Math.PI) / 7;
                const outerX = Math.cos(angle) * 40;
                const outerY = Math.sin(angle) * 40;
                
                if (i === 0) ctx.moveTo(outerX, outerY);
                else ctx.lineTo(outerX, outerY);
                
                // Connect to next outer point through center area
                const nextAngle = ((i + 1) * 2 * Math.PI) / 7;
                const nextOuterX = Math.cos(nextAngle) * 40;
                const nextOuterY = Math.sin(nextAngle) * 40;
                ctx.lineTo(nextOuterX * 0.3, nextOuterY * 0.3);
            }
            ctx.closePath();
            
            ctx.fillStyle = 'green';
            ctx.fill(); // nonzero
            ctx.strokeStyle = 'darkgreen';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
            
            // Test: Same scaled star with evenodd (bottom right)
            ctx.save();
            ctx.translate(300, 180);
            ctx.scale(0.8, 1.2);
            
            ctx.beginPath();
            for (let i = 0; i < 7; i++) {
                const angle = (i * 2 * Math.PI) / 7;
                const outerX = Math.cos(angle) * 40;
                const outerY = Math.sin(angle) * 40;
                
                if (i === 0) ctx.moveTo(outerX, outerY);
                else ctx.lineTo(outerX, outerY);
                
                const nextAngle = ((i + 1) * 2 * Math.PI) / 7;
                const nextOuterX = Math.cos(nextAngle) * 40;
                const nextOuterY = Math.sin(nextAngle) * 40;
                ctx.lineTo(nextOuterX * 0.3, nextOuterY * 0.3);
            }
            ctx.closePath();
            
            ctx.fillStyle = 'purple';
            ctx.fill('evenodd');
            ctx.strokeStyle = 'indigo';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
            
            // Test: Highly scaled path with nested shapes (center bottom)
            ctx.save();
            ctx.translate(200, 240);
            ctx.scale(2.0, 0.5);
            
            // Outer rectangle
            ctx.beginPath();
            ctx.rect(-30, -20, 60, 40);
            
            // Inner overlapping rectangles creating complex intersections
            ctx.rect(-20, -15, 15, 30);
            ctx.rect(-5, -15, 15, 30);
            ctx.rect(10, -15, 15, 30);
            
            ctx.fillStyle = 'orange';
            ctx.fill('evenodd');
            ctx.strokeStyle = 'darkorange';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        }
    });

    // Test: Combined Transform + Clip + Fill - Critical stencil buffer test
    // This file will be concatenated into the main visual test suite

    registerVisualTest('combined-transform-clip-fill', {
        name: 'Transform + Clip + Fill',
        width: 400, height: 300,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 400, 300);
            
            // Test: Transform + Circular Clip + Complex Fill (top left)
            ctx.save();
            ctx.translate(100, 80);
            ctx.rotate(Math.PI / 6);
            ctx.scale(1.2, 0.8);
            
            // Create circular clip region
            ctx.beginPath();
            ctx.arc(0, 0, 50, 0, 2 * Math.PI);
            ctx.clip();
            
            // Draw complex intersecting rectangles
            ctx.fillStyle = 'red';
            ctx.fillRect(-60, -30, 40, 60);
            ctx.fillStyle = 'blue';
            ctx.globalAlpha = 0.7;
            ctx.fillRect(-20, -30, 40, 60);
            ctx.fillStyle = 'green';
            ctx.fillRect(20, -30, 40, 60);
            ctx.restore();
            
            // Test: Nested Transform + Multiple Clips (top right)
            ctx.save();
            ctx.translate(300, 80);
            ctx.scale(0.9, 1.1);
            
            // First clip - diamond shape
            ctx.beginPath();
            ctx.moveTo(0, -40);
            ctx.lineTo(40, 0);
            ctx.lineTo(0, 40);
            ctx.lineTo(-40, 0);
            ctx.closePath();
            ctx.clip();
            
            ctx.save();
            ctx.rotate(Math.PI / 4);
            
            // Second clip - rectangle
            ctx.beginPath();
            ctx.rect(-25, -25, 50, 50);
            ctx.clip();
            
            // Fill with pattern
            ctx.fillStyle = 'purple';
            ctx.fillRect(-60, -60, 120, 120);
            
            ctx.fillStyle = 'yellow';
            ctx.globalAlpha = 0.6;
            for (let i = -3; i <= 3; i++) {
                ctx.fillRect(i * 15 - 2, -60, 4, 120);
                ctx.fillRect(-60, i * 15 - 2, 120, 4);
            }
            ctx.restore();
            ctx.restore();
            
            // Test: Critical stencil buffer test with overlapping transforms (bottom left)
            ctx.save();
            ctx.translate(100, 200);
            
            // Create star-shaped clip
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const angle = (i * Math.PI) / 4;
                const radius = (i % 2 === 0) ? 35 : 15;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.clip();
            
            // Multiple transformed fills that stress stencil buffer
            for (let i = 0; i < 6; i++) {
                ctx.save();
                ctx.rotate((i * Math.PI) / 3);
                ctx.scale(1 + i * 0.1, 1 + i * 0.1);
                
                const colors = ['red', 'green', 'blue', 'yellow', 'cyan', 'magenta'];
                ctx.fillStyle = colors[i];
                ctx.globalAlpha = 0.5;
                ctx.fillRect(-20, -5, 40, 10);
                ctx.restore();
            }
            ctx.restore();
            
            // Test: Complex nested save/restore with clipping (bottom right)
            ctx.save();
            ctx.translate(300, 200);
            ctx.scale(1.3, 0.7);
            
            // Level 1 clip
            ctx.beginPath();
            ctx.arc(0, 0, 45, 0, 2 * Math.PI);
            ctx.clip();
            ctx.fillStyle = 'lightblue';
            ctx.fillRect(-60, -60, 120, 120);
            
            ctx.save();
            ctx.rotate(Math.PI / 8);
            
            // Level 2 clip
            ctx.beginPath();
            ctx.rect(-30, -20, 60, 40);
            ctx.clip();
            ctx.fillStyle = 'orange';
            ctx.fillRect(-60, -60, 120, 120);
            
            ctx.save();
            ctx.scale(0.8, 1.2);
            
            // Level 3 clip - use arc instead of ellipse for compatibility
            ctx.beginPath();
            ctx.arc(0, 0, 20, 0, 2 * Math.PI);
            ctx.clip();
            ctx.fillStyle = 'darkred';
            ctx.fillRect(-60, -60, 120, 120);
            
            ctx.restore(); // Back to level 2
            ctx.restore(); // Back to level 1
            ctx.restore(); // Back to base
        }
    });

    // Test: Combined Transform + Fill + Scale - Scaled paths with fill rules
    // This file will be concatenated into the main visual test suite

    registerVisualTest('combined-transform-fill-scale-v2', {
        name: 'Scaled paths with fill rules (asymmetric)',
        width: 400, height: 300,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 400, 300);
            
            // Test: Asymmetrically scaled star with nonzero fill rule (top left)
            ctx.save();
            ctx.translate(100, 75);
            ctx.scale(1.5, 0.8); // Wide and short
            
            ctx.beginPath();
            // Create 5-pointed star
            for (let i = 0; i < 5; i++) {
                const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                const outerRadius = 25;
                const innerRadius = 12;
                
                const outerX = Math.cos(angle) * outerRadius;
                const outerY = Math.sin(angle) * outerRadius;
                const innerAngle = angle + Math.PI / 5;
                const innerX = Math.cos(innerAngle) * innerRadius;
                const innerY = Math.sin(innerAngle) * innerRadius;
                
                if (i === 0) ctx.moveTo(outerX, outerY);
                else ctx.lineTo(outerX, outerY);
                ctx.lineTo(innerX, innerY);
            }
            ctx.closePath();
            
            ctx.fillStyle = 'red';
            ctx.fill('nonzero');
            ctx.restore();
            
            // Test: Scaled self-intersecting shape with evenodd rule (top right)
            ctx.save();
            ctx.translate(300, 75);
            ctx.scale(0.7, 1.8); // Tall and narrow
            
            ctx.beginPath();
            // Bow-tie / hourglass shape
            ctx.moveTo(-30, -20);
            ctx.lineTo(30, 20);
            ctx.lineTo(-30, 20);
            ctx.lineTo(30, -20);
            ctx.closePath();
            
            ctx.fillStyle = 'green';
            ctx.fill('evenodd');
            ctx.restore();
            
            // Test: Multiple scaled concentric shapes (bottom left)
            const scales = [1.0, 0.75, 0.5, 0.25];
            const colors = ['blue', 'orange', 'purple', 'yellow'];
            
            ctx.save();
            ctx.translate(100, 200);
            
            for (let i = 0; i < scales.length; i++) {
                ctx.save();
                ctx.scale(scales[i], scales[i]);
                
                ctx.beginPath();
                // Hexagon
                for (let j = 0; j < 6; j++) {
                    const angle = (j * Math.PI) / 3;
                    const x = Math.cos(angle) * 30;
                    const y = Math.sin(angle) * 30;
                    if (j === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                
                ctx.fillStyle = colors[i];
                ctx.fill();
                ctx.restore();
            }
            ctx.restore();
            
            // Test: Extremely scaled bezier curves (bottom right)
            ctx.save();
            ctx.translate(300, 200);
            ctx.scale(2.5, 0.4); // Very wide and very short
            
            ctx.beginPath();
            ctx.moveTo(-20, -15);
            ctx.bezierCurveTo(-15, -30, 15, -30, 20, -15);
            ctx.bezierCurveTo(25, 0, 25, 0, 20, 15);
            ctx.bezierCurveTo(15, 30, -15, 30, -20, 15);
            ctx.bezierCurveTo(-25, 0, -25, 0, -20, -15);
            ctx.closePath();
            
            ctx.fillStyle = 'magenta';
            ctx.fill();
            ctx.restore();
        }
    });

    // Test: Combined All Features + GlobalAlpha - Ultimate comprehensive test
    // This file will be concatenated into the main visual test suite

    registerVisualTest('combined-all-features', {
        name: 'All features + globalAlpha',
        width: 400, height: 300,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 400, 300);
            
            // ULTIMATE COMPREHENSIVE TEST: All features combined
            // This test exercises transforms, clipping, fill rules, strokes, and global alpha
            
            // Test: Transformed + Clipped + Alpha Blended Complex Shapes (top left)
            ctx.save();
            ctx.globalAlpha = 0.8;
            ctx.translate(100, 70);
            ctx.rotate(Math.PI / 12);
            ctx.scale(1.2, 0.9);
            
            // Complex star clip region
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI) / 3;
                const outerR = 35, innerR = 18;
                
                const outerX = Math.cos(angle) * outerR;
                const outerY = Math.sin(angle) * outerR;
                if (i === 0) ctx.moveTo(outerX, outerY);
                else ctx.lineTo(outerX, outerY);
                
                const innerAngle = angle + Math.PI / 6;
                const innerX = Math.cos(innerAngle) * innerR;
                const innerY = Math.sin(innerAngle) * innerR;
                ctx.lineTo(innerX, innerY);
            }
            ctx.closePath();
            ctx.clip();
            
            // Multiple overlapping shapes with different alphas
            ctx.fillStyle = 'red';
            ctx.globalAlpha = 0.6;
            ctx.fillRect(-30, -25, 35, 50);
            
            ctx.fillStyle = 'blue';
            ctx.globalAlpha = 0.7;
            ctx.fillRect(-5, -25, 35, 50);
            
            ctx.fillStyle = 'green';
            ctx.globalAlpha = 0.5;
            ctx.fillRect(15, -25, 35, 50);
            ctx.restore();
            
            // Test: Advanced path with evenodd fill + stroke + alpha (top right)
            ctx.save();
            ctx.globalAlpha = 0.9;
            ctx.translate(300, 70);
            ctx.rotate(-Math.PI / 8);
            
            // Create complex self-intersecting path
            ctx.beginPath();
            const points = [
                [-40, -30], [40, -15], [-25, 20], [30, -35], [-35, 35], 
                [45, 10], [-15, -40], [20, 30], [-45, -10], [35, -20]
            ];
            
            points.forEach((point, i) => {
                if (i === 0) ctx.moveTo(point[0], point[1]);
                else ctx.lineTo(point[0], point[1]);
            });
            ctx.closePath();
            
            ctx.fillStyle = 'purple';
            ctx.globalAlpha = 0.6;
            ctx.fill('evenodd');
            
            ctx.strokeStyle = 'darkmagenta';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.9;
            ctx.stroke();
            ctx.restore();
            
            // Test: Nested clipping + transforms + gradual alpha changes (bottom left)
            ctx.save();
            ctx.translate(100, 200);
            ctx.scale(0.8, 1.1);
            
            // Outer clip - hexagon
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI) / 3;
                const x = Math.cos(angle) * 40;
                const y = Math.sin(angle) * 40;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.clip();
            
            // Inner transformation and clipping
            ctx.save();
            ctx.rotate(Math.PI / 6);
            
            ctx.beginPath();
            ctx.arc(0, 0, 25, 0, 2 * Math.PI);
            ctx.clip();
            
            // Concentric circles with varying alpha
            for (let i = 5; i >= 1; i--) {
                const radius = i * 4;
                const alpha = Math.min(0.2 + (i * 0.15), 1.0); // Ensure alpha <= 1.0
                
                // Convert HSL to RGB to avoid color parsing issues with globalAlpha
                const hue = i * 60;
                const colors = ['#d64545', '#d6a745', '#a7d645', '#45d645', '#45d6a7'];
                
                ctx.globalAlpha = alpha;
                ctx.fillStyle = colors[i - 1];
                
                ctx.beginPath();
                ctx.arc(0, 0, radius, 0, 2 * Math.PI);
                ctx.fill();
            }
            ctx.restore();
            ctx.restore();
            
            // Test: Ultimate complexity - all features combined (bottom right)
            ctx.save();
            ctx.globalAlpha = 0.85;
            ctx.translate(300, 200);
            ctx.rotate(Math.PI / 10);
            ctx.scale(1.1, 0.9);
            
            // Multi-level nested clipping and transformations
            for (let level = 0; level < 3; level++) {
                ctx.save();
                ctx.rotate((level * Math.PI) / 4);
                ctx.scale(1 - level * 0.15, 1 - level * 0.15);
                
                // Create clip region based on level
                ctx.beginPath();
                if (level === 0) {
                    ctx.rect(-35, -25, 70, 50);
                } else if (level === 1) {
                    ctx.arc(0, 0, 30, 0, 2 * Math.PI);
                } else {
                    for (let i = 0; i < 5; i++) {
                        const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                        const x = Math.cos(angle) * 20;
                        const y = Math.sin(angle) * 20;
                        if (i === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                    ctx.closePath();
                }
                ctx.clip();
                
                // Draw with different features per level
                const colors = ['cyan', 'yellow', 'magenta'];
                ctx.fillStyle = colors[level];
                ctx.globalAlpha = 0.4 + level * 0.2;
                
                if (level === 0) {
                    // Pattern fill
                    for (let i = -4; i <= 4; i++) {
                        ctx.fillRect(i * 8 - 1, -40, 2, 80);
                    }
                } else if (level === 1) {
                    // Radial pattern
                    for (let r = 5; r <= 25; r += 5) {
                        ctx.beginPath();
                        ctx.arc(0, 0, r, 0, 2 * Math.PI);
                        ctx.fill();
                    }
                } else {
                    // Complex intersecting shapes
                    ctx.beginPath();
                    ctx.moveTo(-15, -10);
                    ctx.lineTo(15, -10);
                    ctx.lineTo(0, 15);
                    ctx.closePath();
                    ctx.fill('evenodd');
                    
                    ctx.strokeStyle = 'darkred';
                    ctx.lineWidth = 1;
                    ctx.globalAlpha = 0.8;
                    ctx.stroke();
                }
                
                ctx.restore();
            }
            ctx.restore();
            
            // Reset global alpha
            ctx.globalAlpha = 1.0;
        }
    });

    // Test: Combined Transform + Clip + Fill - Critical stencil buffer test
    // This file will be concatenated into the main visual test suite

    registerVisualTest('combined-transform-clip-fill-v2', {
        name: 'Transform + Clip + Fill (rotated clip)',
        width: 400, height: 300,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 400, 300);
            
            // Test: Rotated clip with translated fill (top left)
            ctx.save();
            ctx.translate(100, 75);
            
            // Rotated circular clip
            ctx.save();
            ctx.rotate(Math.PI / 4);
            ctx.beginPath();
            ctx.arc(0, 0, 25, 0, 2 * Math.PI);
            ctx.clip();
            ctx.restore();
            
            // Translated fill
            ctx.translate(10, 10);
            ctx.fillStyle = 'red';
            ctx.fillRect(-30, -30, 60, 60);
            ctx.restore();
            
            // Test: Scaled clip with scaled fill (top right)
            ctx.save();
            ctx.translate(300, 75);
            ctx.scale(1.5, 0.8);
            
            // Star clip shape
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                const outerRadius = 20;
                const innerRadius = 10;
                
                const outerX = Math.cos(angle) * outerRadius;
                const outerY = Math.sin(angle) * outerRadius;
                const innerAngle = angle + Math.PI / 5;
                const innerX = Math.cos(innerAngle) * innerRadius;
                const innerY = Math.sin(innerAngle) * innerRadius;
                
                if (i === 0) ctx.moveTo(outerX, outerY);
                else ctx.lineTo(outerX, outerY);
                ctx.lineTo(innerX, innerY);
            }
            ctx.closePath();
            ctx.clip();
            
            // Fill with complex path
            ctx.beginPath();
            ctx.moveTo(-25, -20);
            ctx.quadraticCurveTo(0, -35, 25, -20);
            ctx.quadraticCurveTo(35, 0, 25, 20);
            ctx.quadraticCurveTo(0, 35, -25, 20);
            ctx.quadraticCurveTo(-35, 0, -25, -20);
            ctx.closePath();
            
            ctx.fillStyle = 'green';
            ctx.fill();
            ctx.restore();
            
            // Test: Multiple clip intersections with transforms (bottom left)
            ctx.save();
            ctx.translate(100, 200);
            
            // First clip: rotated rectangle
            ctx.save();
            ctx.rotate(Math.PI / 6);
            ctx.rect(-25, -15, 50, 30);
            ctx.clip();
            ctx.restore();
            
            // Second clip: scaled circle (intersection)
            ctx.save();
            ctx.scale(1.2, 0.6);
            ctx.beginPath();
            ctx.arc(0, 0, 25, 0, 2 * Math.PI);
            ctx.clip();
            ctx.restore();
            
            // Fill should only appear in intersection
            ctx.fillStyle = 'blue';
            ctx.fillRect(-40, -40, 80, 80);
            ctx.restore();
            
            // Test: Complex nested transforms with clips (bottom right)
            ctx.save();
            ctx.translate(300, 200);
            ctx.rotate(-Math.PI / 8);
            ctx.scale(0.9, 1.1);
            
            // Outer clip: diamond
            ctx.beginPath();
            ctx.moveTo(0, -30);
            ctx.lineTo(30, 0);
            ctx.lineTo(0, 30);
            ctx.lineTo(-30, 0);
            ctx.closePath();
            ctx.clip();
            
            ctx.save();
            ctx.translate(5, -5);
            ctx.rotate(Math.PI / 4);
            ctx.scale(1.2, 0.8);
            
            // Inner clip: triangle
            ctx.beginPath();
            ctx.moveTo(0, -15);
            ctx.lineTo(15, 15);
            ctx.lineTo(-15, 15);
            ctx.closePath();
            ctx.clip();
            
            // Complex fill path
            ctx.beginPath();
            ctx.moveTo(-20, -20);
            ctx.bezierCurveTo(-10, -30, 10, -30, 20, -20);
            ctx.bezierCurveTo(30, -10, 30, 10, 20, 20);
            ctx.bezierCurveTo(10, 30, -10, 30, -20, 20);
            ctx.bezierCurveTo(-30, 10, -30, -10, -20, -20);
            ctx.closePath();
            
            ctx.fillStyle = 'purple';
            ctx.fill();
            ctx.restore();
            ctx.restore();
        }
    });

    // Test: Combined All Features + GlobalAlpha - Spiral stroke version
    // This file will be concatenated into the main visual test suite

    registerVisualTest('combined-all-features-v2', {
        name: 'All features + globalAlpha (spiral stroke)',
        width: 400, height: 300,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 400, 300);
            
            // Test: Rotated clip with semi-transparent fill (top left)
            ctx.save();
            ctx.translate(100, 75);
            ctx.rotate(Math.PI / 6);
            ctx.globalAlpha = 0.7;
            
            // Diamond clip
            ctx.beginPath();
            ctx.moveTo(0, -25);
            ctx.lineTo(25, 0);
            ctx.lineTo(0, 25);
            ctx.lineTo(-25, 0);
            ctx.closePath();
            ctx.clip();
            
            // Complex filled path with transparency
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI) / 3;
                const x = Math.cos(angle) * 20;
                const y = Math.sin(angle) * 20;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            
            ctx.fillStyle = 'red';
            ctx.fill();
            ctx.restore();
            
            // Test: Scaled stroke with clip and alpha (top right)
            ctx.save();
            ctx.translate(300, 75);
            ctx.scale(1.2, 0.8);
            ctx.globalAlpha = 0.6;
            
            // Circular clip
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, 2 * Math.PI);
            ctx.clip();
            
            // Stroked spiral path
            ctx.beginPath();
            ctx.moveTo(0, 0);
            for (let t = 0; t < 4 * Math.PI; t += 0.2) {
                const r = t * 3;
                const x = Math.cos(t) * r;
                const y = Math.sin(t) * r;
                ctx.lineTo(x, y);
            }
            
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'green';
            ctx.stroke();
            ctx.restore();
            
            // Test: Multiple nested clips with varying alpha (bottom left)
            ctx.save();
            ctx.translate(100, 200);
            
            // First clip: rotated rectangle
            ctx.save();
            ctx.rotate(-Math.PI / 8);
            ctx.rect(-30, -20, 60, 40);
            ctx.clip();
            ctx.restore();
            
            // Second clip: scaled ellipse
            ctx.save();
            ctx.scale(0.8, 1.3);
            ctx.beginPath();
            ctx.arc(0, 0, 25, 0, 2 * Math.PI);
            ctx.clip();
            ctx.restore();
            
            // Layer 1: Semi-transparent background
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = 'blue';
            ctx.fillRect(-40, -40, 80, 80);
            
            // Layer 2: More transparent overlay
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.moveTo(-15, -20);
            ctx.quadraticCurveTo(0, -30, 15, -20);
            ctx.quadraticCurveTo(25, 0, 15, 20);
            ctx.quadraticCurveTo(0, 30, -15, 20);
            ctx.quadraticCurveTo(-25, 0, -15, -20);
            ctx.closePath();
            
            ctx.fillStyle = 'orange';
            ctx.fill();
            ctx.restore();
            
            // Test: Ultimate complexity - all features combined (bottom right)
            ctx.save();
            ctx.translate(300, 200);
            ctx.rotate(Math.PI / 12);
            ctx.scale(1.1, 0.9);
            ctx.globalAlpha = 0.8;
            
            // Complex clip shape: star with hole
            ctx.beginPath();
            // Outer star
            for (let i = 0; i < 5; i++) {
                const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                const outerRadius = 25;
                const innerRadius = 12;
                
                const outerX = Math.cos(angle) * outerRadius;
                const outerY = Math.sin(angle) * outerRadius;
                const innerAngle = angle + Math.PI / 5;
                const innerX = Math.cos(innerAngle) * innerRadius;
                const innerY = Math.sin(innerAngle) * innerRadius;
                
                if (i === 0) ctx.moveTo(outerX, outerY);
                else ctx.lineTo(outerX, outerY);
                ctx.lineTo(innerX, innerY);
            }
            ctx.closePath();
            ctx.clip();
            
            // Fill with complex path
            ctx.save();
            ctx.rotate(-Math.PI / 4);
            ctx.globalAlpha = 0.9; // Alpha on alpha
            
            ctx.beginPath();
            ctx.moveTo(-20, -15);
            ctx.bezierCurveTo(-10, -25, 10, -25, 20, -15);
            ctx.bezierCurveTo(25, 0, 25, 0, 20, 15);
            ctx.bezierCurveTo(10, 25, -10, 25, -20, 15);
            ctx.bezierCurveTo(-25, 0, -25, 0, -20, -15);
            ctx.closePath();
            
            ctx.fillStyle = 'purple';
            ctx.fill();
            
            // Add stroked outline on top
            ctx.globalAlpha = 0.7;
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'magenta';
            ctx.stroke();
            ctx.restore();
            ctx.restore();
        }
    });

    // Test: Pixel Analysis - Check exact pixel values at center
    // This file will be concatenated into the main visual test suite

    registerVisualTest('pixel-analysis', {
        name: 'Pixel Analysis Test',
        width: 200, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 200);
            
            ctx.save();
            ctx.translate(100, 100);
            
            // First layer: Semi-transparent blue at alpha 0.4
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = 'blue'; // RGB(0, 0, 255)
            ctx.fillRect(-30, -30, 60, 60);
            
            // Second layer: Semi-transparent orange at alpha 0.6, overlapping
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = 'orange'; // RGB(255, 165, 0)
            ctx.fillRect(-20, -20, 40, 40);
            
            ctx.restore();
            
            // Unified pixel analysis using standard getImageData API
            const imageData = ctx.getImageData(100, 100, 1, 1);
            const r = imageData.data[0];
            const g = imageData.data[1];
            const b = imageData.data[2];
            const a = imageData.data[3];
            console.log(`Center pixel: R=${r}, G=${g}, B=${b}, A=${a}`);
        },
    });

    // Test: Combined Transform + Stroke + Rotate
    // This file will be concatenated into the main visual test suite

    registerVisualTest('combined-transform-stroke-rotate', {
        name: 'Rotated Stroke Joins',
        width: 200, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 200);
            
            ctx.save();
            ctx.translate(100, 100);
            ctx.rotate(Math.PI / 6); // 30 degrees
            ctx.scale(1.2, 0.8); // Non-uniform scaling
            
            // Complex path with sharp corners to test stroke joins
            ctx.beginPath();
            ctx.moveTo(-60, -40);
            ctx.lineTo(20, -40);
            ctx.lineTo(40, -20);
            ctx.lineTo(40, 20);
            ctx.lineTo(20, 40);
            ctx.lineTo(-20, 40);
            ctx.lineTo(-40, 20);
            ctx.lineTo(-40, -20);
            ctx.closePath();
            
            // Test different stroke properties
            ctx.lineWidth = 8;
            ctx.lineJoin = 'miter';
            ctx.miterLimit = 4;
            ctx.globalAlpha = 0.8;
            
            ctx.strokeStyle = 'blue';
            ctx.stroke();
            
            // Add smaller rotated shape inside
            ctx.save();
            ctx.rotate(Math.PI / 4); // Additional 45 degrees
            ctx.beginPath();
            ctx.moveTo(-15, -15);
            ctx.lineTo(15, -15);
            ctx.lineTo(15, 15);
            ctx.lineTo(-15, 15);
            ctx.closePath();
            
            ctx.lineWidth = 4;
            ctx.lineJoin = 'round';
            ctx.strokeStyle = 'orange';
            ctx.stroke();
            ctx.restore();
            
            ctx.restore();
        },
    });

    // Test: Combined Transform + Clip + Stroke
    // This file will be concatenated into the main visual test suite

    registerVisualTest('combined-transform-clip-stroke', {
        name: 'Transform + Clip + Stroke',
        width: 200, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 200);
            
            ctx.save();
            ctx.translate(100, 100);
            ctx.rotate(Math.PI / 8); // Small rotation
            
            // Create clipping region: circle
            ctx.beginPath();
            ctx.arc(0, 0, 60, 0, 2 * Math.PI);
            ctx.clip();
            
            // Now apply additional transform and stroke
            ctx.save();
            ctx.scale(1.5, 0.8);
            ctx.rotate(Math.PI / 6);
            
            // Draw stroked shapes that will be clipped
            ctx.beginPath();
            ctx.moveTo(-80, -40);
            ctx.lineTo(80, -40);
            ctx.lineTo(80, 40);
            ctx.lineTo(-80, 40);
            ctx.closePath();
            
            ctx.lineWidth = 12;
            ctx.lineJoin = 'round';
            ctx.globalAlpha = 0.8;
            ctx.strokeStyle = 'red';
            ctx.stroke();
            
            // Add diagonal lines
            ctx.beginPath();
            ctx.moveTo(-60, -60);
            ctx.lineTo(60, 60);
            ctx.moveTo(-60, 60);
            ctx.lineTo(60, -60);
            
            ctx.lineWidth = 6;
            ctx.strokeStyle = 'blue';
            ctx.stroke();
            ctx.restore();
            
            ctx.restore();
        },
    });

    // ===== PHASE 5: IMAGE RENDERING TESTS =====

    // Test: Basic drawImage
    // This file will be concatenated into the main visual test suite

    registerVisualTest('drawimage-basic', {
        name: 'Basic drawImage positioning',
        width: 200, height: 150,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 150);
            
            // Create test image compatible with both canvas types
            const testImage = createTestImage(20, 20, 'checkerboard', ctx);
            
            // Draw at different positions
            ctx.drawImage(testImage, 10, 10);        // Basic position
            ctx.drawImage(testImage, 50, 10);        // Right
            ctx.drawImage(testImage, 10, 50);        // Below
            ctx.drawImage(testImage, 50, 50);        // Diagonal
        },
    });

    // Test: Combined Transform + Stroke + Scale
    // This file will be concatenated into the main visual test suite

    registerVisualTest('combined-transform-stroke-scale', {
        name: 'Scaled Stroke Behavior',
        width: 200, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 200);
            
            // Test different scaling effects on strokes
            const scales = [[2, 1], [1, 2], [0.5, 2], [1.5, 1.5]];
            const colors = ['red', 'blue', 'green', 'purple'];
            
            for (let i = 0; i < scales.length; i++) {
                ctx.save();
                ctx.translate(50 + (i % 2) * 100, 50 + Math.floor(i / 2) * 100);
                ctx.scale(scales[i][0], scales[i][1]);
                
                // Circle that will be scaled
                ctx.beginPath();
                ctx.arc(0, 0, 30, 0, 2 * Math.PI);
                
                ctx.lineWidth = 6;
                ctx.lineJoin = 'miter';
                ctx.globalAlpha = 0.7;
                
                ctx.strokeStyle = colors[i];
                ctx.stroke();
                
                // Add a cross inside to show scaling effects
                ctx.beginPath();
                ctx.moveTo(-20, 0);
                ctx.lineTo(20, 0);
                ctx.moveTo(0, -20);
                ctx.lineTo(0, 20);
                
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.restore();
            }
        },
    });

    // Test: drawImage scaling
    // This file will be concatenated into the main visual test suite

    registerVisualTest('drawimage-scaling', {
        name: 'drawImage with scaling',
        width: 200, height: 150,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 150);
            
            // Create gradient test image compatible with both canvas types
            const testImage = createTestImage(10, 10, 'gradient', ctx);
            
            // Draw at original size
            ctx.drawImage(testImage, 10, 10);
            
            // Draw scaled up 2x
            ctx.drawImage(testImage, 30, 10, 20, 20);
            
            // Draw scaled up 3x
            ctx.drawImage(testImage, 60, 10, 30, 30);
            
            // Draw scaled down
            ctx.drawImage(testImage, 100, 10, 5, 5);
            
            // Draw with non-uniform scaling
            ctx.drawImage(testImage, 10, 50, 40, 10);
        },
    });

    // Test: RGB to RGBA conversion
    // This file will be concatenated into the main visual test suite

    registerVisualTest('drawimage-rgb-conversion', {
        name: 'RGB to RGBA auto-conversion',
        width: 200, height: 150,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 150);
            
            // Create RGB test image compatible with both canvas types
            const rgbImage = createTestImage(30, 30, 'rgbtest', ctx);
            
            // Draw RGB image - should auto-convert to RGBA
            ctx.drawImage(rgbImage, 20, 20);
            
            // Create RGBA test image for comparison
            const rgbaImage = createTestImage(30, 30, 'border', ctx);
            ctx.drawImage(rgbaImage, 70, 20);
        },
    });

    // Test: drawImage with transforms
    // This file will be concatenated into the main visual test suite

    registerVisualTest('drawimage-transforms', {
        name: 'drawImage with transforms',
        width: 200, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 200);
            
            // Create compatible test image for both canvas types
            const testImage = createTestImage(20, 20, 'checkerboard', ctx);
            
            // Original
            ctx.drawImage(testImage, 10, 10);
            
            // Translated
            ctx.save();
            ctx.translate(50, 50);
            ctx.drawImage(testImage, 0, 0);
            ctx.restore();
            
            // Scaled  
            ctx.save();
            ctx.translate(100, 100);
            ctx.scale(1.5, 1.5);
            ctx.drawImage(testImage, 0, 0);
            ctx.restore();
            
            // Rotated
            ctx.save();
            ctx.translate(150, 150);
            ctx.rotate(Math.PI / 4);
            ctx.drawImage(testImage, -10, -10);
            ctx.restore();
        },
    });

    // Test: drawImage with alpha and blending
    // This file will be concatenated into the main visual test suite

    registerVisualTest('drawimage-alpha-blending', {
        name: 'drawImage with alpha and blending',
        width: 200, height: 150,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            // Colored background
            ctx.fillStyle = 'lightblue';
            ctx.fillRect(0, 0, 200, 150);
            
            // Create alpha gradient image compatible with both canvas types
            const alphaImage = createTestImage(40, 40, 'alpha', ctx);
            
            // Draw with full alpha
            ctx.drawImage(alphaImage, 20, 20);
            
            // Draw with global alpha
            ctx.globalAlpha = 0.5;
            ctx.drawImage(alphaImage, 80, 20);
            ctx.globalAlpha = 1.0;
            
            // Draw overlapping for blending test
            const solidImage = createTestImage(30, 30, 'checkerboard', ctx);
            ctx.drawImage(solidImage, 120, 50);
            ctx.drawImage(alphaImage, 130, 60);
        },
    });

    // Test: Advanced drawImage using surface-to-ImageLike conversion
    // This file will be concatenated into the main visual test suite

    registerVisualTest('drawimage-surface-conversion', {
        name: 'drawImage using surface-to-ImageLike conversion',
        width: 200, height: 150,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 150);
            
            // Create source image using pattern system compatible with both canvas types
            const sourceImage = createTestImage(40, 40, 'overlapping-squares', ctx);
            
            // Draw the source image at different positions and scales
            ctx.drawImage(sourceImage, 20, 20);           // Original size
            ctx.drawImage(sourceImage, 80, 20, 20, 20);   // Scaled down
            ctx.drawImage(sourceImage, 120, 20, 60, 60);  // Scaled up
        },
    });

    // Test: Sub-pixel stroke rendering comparison
    // This file will be concatenated into the main visual test suite

    registerVisualTest('subpixel-strokes', {
        name: 'Sub-pixel Stroke Rendering',
        width: 600,
        height: 400,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 600, 400);
            
            // Test different stroke widths
            const strokeWidths = [0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0];
            const colors = ['red', 'blue', 'green', 'purple', 'orange', 'brown', 'pink'];
            
            // Horizontal lines
            for (let i = 0; i < strokeWidths.length; i++) {
                ctx.strokeStyle = colors[i];
                ctx.lineWidth = strokeWidths[i];
                ctx.beginPath();
                ctx.moveTo(50, 50 + i * 30);
                ctx.lineTo(200, 50 + i * 30);
                ctx.stroke();
                
                // Label the width
                ctx.fillStyle = 'black';
                if (ctx.fillText) {
                    // HTML5Canvas: use fillText
                    ctx.font = '10px Arial';
                    ctx.fillText(strokeWidths[i].toString(), 10, 55 + i * 30);
                } else {
                    // SWCanvas: use a small rect to indicate width
                    ctx.fillRect(20, 45 + i * 30, 2, strokeWidths[i] * 10 + 2);
                }
            }
            
            // Vertical lines
            for (let i = 0; i < strokeWidths.length; i++) {
                ctx.strokeStyle = colors[i];
                ctx.lineWidth = strokeWidths[i];
                ctx.beginPath();
                ctx.moveTo(250 + i * 30, 50);
                ctx.lineTo(250 + i * 30, 200);
                ctx.stroke();
            }
            
            // Diagonal lines
            for (let i = 0; i < strokeWidths.length; i++) {
                ctx.strokeStyle = colors[i];
                ctx.lineWidth = strokeWidths[i];
                ctx.beginPath();
                ctx.moveTo(50 + i * 25, 250);
                ctx.lineTo(150 + i * 25, 350);
                ctx.stroke();
            }
            
            // Rectangles
            for (let i = 0; i < strokeWidths.length; i++) {
                ctx.strokeStyle = colors[i];
                ctx.lineWidth = strokeWidths[i];
                ctx.beginPath();
                ctx.rect(300 + (i % 4) * 60, 250 + Math.floor(i / 4) * 60, 40, 40);
                ctx.stroke();
            }
            
            // Circles
            for (let i = 0; i < strokeWidths.length; i++) {
                ctx.strokeStyle = colors[i];
                ctx.lineWidth = strokeWidths[i];
                ctx.beginPath();
                ctx.arc(500, 70 + i * 40, 15, 0, 2 * Math.PI);
                ctx.stroke();
            }
        },
    });

    // Test: Stroke edge cases
    // This file will be concatenated into the main visual test suite

    registerVisualTest('stroke-edge-cases', {
        name: 'Stroke Edge Cases',
        width: 500,
        height: 300,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 500, 300);
            
            // Test: Zero-width stroke (SWCanvas renders faint line, HTML5Canvas may not render)
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 0;
            ctx.beginPath();
            ctx.moveTo(50, 50);
            ctx.lineTo(150, 50);
            ctx.stroke();
            
            // Test: Very thin strokes
            const thinWidths = [0.01, 0.1, 0.2, 0.3, 0.4];
            for (let i = 0; i < thinWidths.length; i++) {
                ctx.strokeStyle = 'blue';
                ctx.lineWidth = thinWidths[i];
                ctx.beginPath();
                ctx.moveTo(50, 80 + i * 20);
                ctx.lineTo(150, 80 + i * 20);
                ctx.stroke();
            }
            
            // Test: Strokes with scale transform
            ctx.save();
            ctx.scale(0.5, 0.5);
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.moveTo(400, 100);
            ctx.lineTo(600, 100);
            ctx.stroke();
            ctx.restore();
            
            // Test: Strokes with clipping
            ctx.save();
            ctx.beginPath();
            ctx.rect(250, 50, 100, 80);
            ctx.clip();
            
            ctx.strokeStyle = 'purple';
            ctx.lineWidth = 3.0;
            ctx.beginPath();
            ctx.moveTo(200, 90);
            ctx.lineTo(400, 90);
            ctx.stroke();
            ctx.restore();
            
            // Test: Circles with very thin strokes
            const circleWidths = [0.1, 0.3, 0.5, 1.0, 2.0];
            for (let i = 0; i < circleWidths.length; i++) {
                ctx.strokeStyle = 'orange';
                ctx.lineWidth = circleWidths[i];
                ctx.beginPath();
                ctx.arc(80 + i * 60, 200, 20, 0, 2 * Math.PI);
                ctx.stroke();
            }
            
            // Test: Single pixel positioned strokes
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1.0;
            
            // Integer position
            ctx.beginPath();
            ctx.moveTo(50, 250);
            ctx.lineTo(100, 250);
            ctx.stroke();
            
            // Half-pixel position
            ctx.beginPath();
            ctx.moveTo(50.5, 260);
            ctx.lineTo(100.5, 260);
            ctx.stroke();
            
            // Quarter-pixel position
            ctx.beginPath();
            ctx.moveTo(50.25, 270);
            ctx.lineTo(100.25, 270);
            ctx.stroke();
        }
    });

    // Test: Clipped path strokes (recreates Polygon Clipping star issue)
    // This file will be concatenated into the main visual test suite

    registerVisualTest('clipped-path-strokes', {
        name: 'Clipped Path Strokes',
        width: 400,
        height: 300,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 400, 300);
            
            // Test: Star without clipping (left side)
            const cx1 = 100, cy1 = 80;
            ctx.save();
            ctx.beginPath();
            // Create star path (same as in Polygon Clipping test)
            for (let i = 0; i < 5; i++) {
                const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                const x = cx1 + Math.cos(angle) * 30;
                const y = cy1 + Math.sin(angle) * 30;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
                
                // Inner points
                const innerAngle = angle + Math.PI / 5;
                const ix = cx1 + Math.cos(innerAngle) * 12;
                const iy = cy1 + Math.sin(innerAngle) * 12;
                ctx.lineTo(ix, iy);
            }
            ctx.closePath();
            
            // Fill the star
            ctx.fillStyle = 'lightblue';
            ctx.fill();
            
            // Stroke the star with different widths
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 0.5;
            ctx.stroke();
            ctx.restore();
            
            // Test: Star with clipping (right side) - same as Polygon Clipping
            // NOTE: If you see a thin stroke around the star in some browsers but not in SWCanvas,
            // this is expected. Some browsers incorrectly auto-stroke clip paths, but this is
            // non-standard behavior. Chrome and SWCanvas correctly follow the spec.
            const cx2 = 300, cy2 = 80;
            ctx.save();
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                const x = cx2 + Math.cos(angle) * 30;
                const y = cy2 + Math.sin(angle) * 30;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
                
                const innerAngle = angle + Math.PI / 5;
                const ix = cx2 + Math.cos(innerAngle) * 12;
                const iy = cy2 + Math.sin(innerAngle) * 12;
                ctx.lineTo(ix, iy);
            }
            ctx.closePath();
            ctx.clip(); // Use as clipping region
            
            // Fill rectangles (like in original test)
            ctx.fillStyle = 'purple';
            ctx.fillRect(260, 40, 80, 80);
            ctx.fillStyle = 'yellow';
            ctx.fillRect(280, 60, 40, 40);
            ctx.restore();
            
            // Test: Compare stroke widths
            const strokeWidths = [0.25, 0.5, 1.0, 2.0];
            for (let j = 0; j < strokeWidths.length; j++) {
                const cx = 50 + j * 80;
                const cy = 200;
                
                ctx.save();
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                    const x = cx + Math.cos(angle) * 25;
                    const y = cy + Math.sin(angle) * 25;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                    
                    const innerAngle = angle + Math.PI / 5;
                    const ix = cx + Math.cos(innerAngle) * 10;
                    const iy = cy + Math.sin(innerAngle) * 10;
                    ctx.lineTo(ix, iy);
                }
                ctx.closePath();
                
                // Fill
                ctx.fillStyle = 'lightgray';
                ctx.fill();
                
                // Stroke with different widths
                ctx.strokeStyle = 'blue';
                ctx.lineWidth = strokeWidths[j];
                ctx.stroke();
                ctx.restore();
            }
        }
    });

    // Test: Stroke pixel analysis
    // This file will be concatenated into the main visual test suite

    registerVisualTest('stroke-pixel-analysis', {
        name: 'Stroke Pixel Analysis',
        width: 300,
        height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            // Test: Single pixel stroke at integer coordinates
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.moveTo(50, 50);
            ctx.lineTo(100, 50);
            ctx.stroke();
            
            // Test: Sub-pixel stroke widths at integer coordinates
            const subPixelWidths = [0.1, 0.25, 0.5, 0.75];
            for (let i = 0; i < subPixelWidths.length; i++) {
                ctx.strokeStyle = 'blue';
                ctx.lineWidth = subPixelWidths[i];
                ctx.beginPath();
                ctx.moveTo(50, 70 + i * 10);
                ctx.lineTo(100, 70 + i * 10);
                ctx.stroke();
            }
            
            // Test: 1-pixel stroke at fractional coordinates
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.moveTo(50.5, 120);
            ctx.lineTo(100.5, 120);
            ctx.stroke();
            
            // Test: Sub-pixel strokes at fractional coordinates
            for (let i = 0; i < subPixelWidths.length; i++) {
                ctx.strokeStyle = 'purple';
                ctx.lineWidth = subPixelWidths[i];
                ctx.beginPath();
                ctx.moveTo(50.5, 130 + i * 10);
                ctx.lineTo(100.5, 130 + i * 10);
                ctx.stroke();
            }
            
            // Test: Very thin vertical lines
            const xPositions = [150, 160, 170, 180, 190];
            const thinWidths = [0.1, 0.2, 0.3, 0.5, 1.0];
            for (let i = 0; i < xPositions.length; i++) {
                ctx.strokeStyle = 'orange';
                ctx.lineWidth = thinWidths[i];
                ctx.beginPath();
                ctx.moveTo(xPositions[i], 50);
                ctx.lineTo(xPositions[i], 120);
                ctx.stroke();
            }
            
            // Test: Diagonal lines with thin strokes
            for (let i = 0; i < 3; i++) {
                ctx.strokeStyle = 'brown';
                ctx.lineWidth = 0.25 + i * 0.25;
                ctx.beginPath();
                ctx.moveTo(220, 50 + i * 20);
                ctx.lineTo(270, 100 + i * 20);
                ctx.stroke();
            }
            
            // Unified stroke pixel analysis using standard getImageData API
            try {
                console.log('Stroke pixel analysis:');
                
                // Check red stroke at (50,50)
                const redPixelData = ctx.getImageData(50, 50, 1, 1);
                const redPixel = redPixelData.data[0];
                console.log(`  Pixel at (50,50) - Red stroke 1px: R=${redPixel} (should be 255 if rendered)`);
                
                // Check blue strokes
                const bluePixel70Data = ctx.getImageData(50, 70, 1, 1);
                const bluePixel75Data = ctx.getImageData(50, 75, 1, 1);
                
                const bluePixel70 = bluePixel70Data.data[0];
                const bluePixel75 = bluePixel75Data.data[2];
                
                console.log(`  Pixel at (50,70) - Blue stroke 0.1px: R=${bluePixel70}`);
                console.log(`  Pixel at (50,75) - Blue stroke 0.5px: B=${bluePixel75}`);
            } catch (e) {
                console.log('Could not sample pixels (security restriction)');
            }
        }
    });

    // Test: Basic Line Dash Patterns
    // This file will be concatenated into the main visual test suite

    registerVisualTest('line-dash-basic-patterns', {
        name: 'Line dash - basic patterns',
        width: 300, height: 200,
        // Unified drawing function that works with both canvas types
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 3;
            
            // Test: Solid line (empty dash array)
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(20, 30);
            ctx.lineTo(280, 30);
            ctx.stroke();
            
            // Test: Simple dash pattern [5, 5] - equal dashes and gaps
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(20, 60);
            ctx.lineTo(280, 60);
            ctx.stroke();
            
            // Test: Long dash pattern [15, 5] - long dashes, short gaps
            ctx.setLineDash([15, 5]);
            ctx.beginPath();
            ctx.moveTo(20, 90);
            ctx.lineTo(280, 90);
            ctx.stroke();
            
            // Test: Dot pattern [1, 3] - tiny dashes, larger gaps
            ctx.setLineDash([1, 3]);
            ctx.beginPath();
            ctx.moveTo(20, 120);
            ctx.lineTo(280, 120);
            ctx.stroke();
            
            // Test: Complex pattern [10, 5, 2, 5] - varied dash/gap lengths
            ctx.setLineDash([10, 5, 2, 5]);
            ctx.beginPath();
            ctx.moveTo(20, 150);
            ctx.lineTo(280, 150);
            ctx.stroke();
            
            // Reset to solid for any additional drawing
            ctx.setLineDash([]);
        }
    });

    // Test: Line Dash Offset
    // This file will be concatenated into the main visual test suite

    registerVisualTest('line-dash-offset', {
        name: 'Line dash - offset behavior',
        width: 300, height: 250,
        // Unified drawing function that works with both canvas types
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 250);
            
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 4;
            
            // Use consistent dash pattern [20, 10] for all tests
            ctx.setLineDash([20, 10]);
            
            // Test: No offset (lineDashOffset = 0)
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            ctx.moveTo(50, 40);
            ctx.lineTo(250, 40);
            ctx.stroke();
            
            // Test: Small offset (lineDashOffset = 5)
            ctx.lineDashOffset = 5;
            ctx.beginPath();
            ctx.moveTo(50, 70);
            ctx.lineTo(250, 70);
            ctx.stroke();
            
            // Test: Half pattern offset (lineDashOffset = 15)
            ctx.lineDashOffset = 15;
            ctx.beginPath();
            ctx.moveTo(50, 100);
            ctx.lineTo(250, 100);
            ctx.stroke();
            
            // Test: Full dash length offset (lineDashOffset = 20)
            ctx.lineDashOffset = 20;
            ctx.beginPath();
            ctx.moveTo(50, 130);
            ctx.lineTo(250, 130);
            ctx.stroke();
            
            // Test: Greater than pattern length (lineDashOffset = 35, wraps around)
            ctx.lineDashOffset = 35;
            ctx.beginPath();
            ctx.moveTo(50, 160);
            ctx.lineTo(250, 160);
            ctx.stroke();
            
            // Test: Negative offset (lineDashOffset = -10)
            ctx.lineDashOffset = -10;
            ctx.beginPath();
            ctx.moveTo(50, 190);
            ctx.lineTo(250, 190);
            ctx.stroke();
            
            // Pattern reference at bottom
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.setLineDash([20, 10]);
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            ctx.moveTo(50, 225);
            ctx.lineTo(250, 225);
            ctx.stroke();
            
            // Reset dash pattern
            ctx.setLineDash([]);
            ctx.lineDashOffset = 0;
        }
    });

    // Test: Line Dash with Complex Paths
    // This file will be concatenated into the main visual test suite

    registerVisualTest('line-dash-complex-paths', {
        name: 'Line dash - complex paths and shapes',
        width: 350, height: 300,
        // Unified drawing function that works with both canvas types
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 350, 300);
            
            // Test: Dashed rectangle  
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 3;
            ctx.setLineDash([8, 4]);
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            ctx.rect(20, 20, 80, 60);
            ctx.stroke();
            
            // Test: Dashed circle
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            ctx.arc(180, 50, 35, 0, 2 * Math.PI);
            ctx.stroke();
            
            // Test: Dashed triangle with odd-length pattern
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 4;
            ctx.setLineDash([12, 8, 4]); // Odd length - should duplicate to [12,8,4,12,8,4]
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            ctx.moveTo(280, 20);
            ctx.lineTo(330, 80);
            ctx.lineTo(230, 80);
            ctx.closePath();
            ctx.stroke();
            
            // Test: Dashed bezier curve
            ctx.strokeStyle = 'purple';
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 5]);
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            ctx.moveTo(20, 120);
            ctx.bezierCurveTo(50, 90, 80, 150, 110, 120);
            ctx.stroke();
            
            // Test: Dashed quadratic curve
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 3]);
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            ctx.moveTo(130, 120);
            ctx.quadraticCurveTo(165, 90, 200, 120);
            ctx.stroke();
            
            // Test: Complex path with multiple segments and transforms
            ctx.save();
            ctx.translate(250, 150);
            ctx.rotate(Math.PI / 6);
            ctx.strokeStyle = 'darkred';
            ctx.lineWidth = 3;
            ctx.setLineDash([15, 5, 5, 5]);
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            ctx.moveTo(-30, -20);
            ctx.lineTo(30, -20);
            ctx.lineTo(40, 0);
            ctx.lineTo(30, 20);
            ctx.lineTo(-30, 20);
            ctx.lineTo(-40, 0);
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
            
            // Test: Star shape with dashed outline
            ctx.strokeStyle = 'darkgreen';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 2]);
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            const cx = 60, cy = 220, outerRadius = 35, innerRadius = 15;
            for (let i = 0; i < 5; i++) {
                const outerAngle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                const innerAngle = ((i + 0.5) * 2 * Math.PI) / 5 - Math.PI / 2;
                
                const outerX = cx + outerRadius * Math.cos(outerAngle);
                const outerY = cy + outerRadius * Math.sin(outerAngle);
                const innerX = cx + innerRadius * Math.cos(innerAngle);
                const innerY = cy + innerRadius * Math.sin(innerAngle);
                
                if (i === 0) {
                    ctx.moveTo(outerX, outerY);
                } else {
                    ctx.lineTo(outerX, outerY);
                }
                ctx.lineTo(innerX, innerY);
            }
            ctx.closePath();
            ctx.stroke();
            
            // Test: Arc with dashed stroke
            ctx.strokeStyle = 'darkblue';
            ctx.lineWidth = 3;
            ctx.setLineDash([12, 6]);
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            ctx.arc(180, 220, 40, 0.2 * Math.PI, 1.8 * Math.PI);
            ctx.stroke();
            
            // Reset dash patterns
            ctx.setLineDash([]);
            ctx.lineDashOffset = 0;
        }
    });

    // Test: Linear Gradient Basic Test
    // This file will be concatenated into the main visual test suite

    registerVisualTest('linear-gradient-basic', {
        name: 'Linear gradient - basic horizontal gradient',
        width: 200, height: 150,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Clear background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 150);
            
            // Create horizontal linear gradient
            const grad = ctx.createLinearGradient(20, 0, 180, 0);
            grad.addColorStop(0, 'red');
            grad.addColorStop(0.5, 'yellow');
            grad.addColorStop(1, 'blue');
            
            // Fill rectangle with gradient
            ctx.fillStyle = grad;
            ctx.fillRect(20, 30, 160, 80);
            
            // Add border
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.strokeRect(20, 30, 160, 80);
        }
    });

    // Test: Radial Gradient Basic Test
    // This file will be concatenated into the main visual test suite

    registerVisualTest('radial-gradient-basic', {
        name: 'Radial gradient - basic circular gradient',
        width: 200, height: 150,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Clear background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 150);
            
            // Create radial gradient
            const grad = ctx.createRadialGradient(100, 75, 10, 100, 75, 60);
            grad.addColorStop(0, 'yellow');
            grad.addColorStop(0.7, 'orange');
            grad.addColorStop(1, 'red');
            
            // Fill circle with gradient
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(100, 75, 60, 0, Math.PI * 2);
            ctx.fill();
            
            // Add border
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });

    // Test: Pattern Basic Test
    // This file will be concatenated into the main visual test suite

    registerVisualTest('pattern-basic', {
        name: 'Pattern - basic repeating pattern',
        width: 200, height: 150,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Clear background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 150);
            
            // Create a test image with checkerboard pattern
            const tileImage = createTestImage(16, 16, 'checkerboard', ctx);
            
            // Create pattern from test image
            const pattern = ctx.createPattern(tileImage, 'repeat');
            
            // Fill rectangle with pattern
            ctx.fillStyle = pattern;
            ctx.fillRect(20, 20, 160, 110);
            
            // Add border
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.strokeRect(20, 20, 160, 110);
        }
    });

    // Test: Conic Gradient Basic Test
    // This file will be concatenated into the main visual test suite

    registerVisualTest('conic-gradient-basic', {
        name: 'Conic gradient - basic sweep gradient',
        width: 200, height: 150,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Clear background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 150);
            
            // Create conic gradient (sweep from top, clockwise)
            const grad = ctx.createConicGradient(-Math.PI/2, 100, 75);
            grad.addColorStop(0, 'red');
            grad.addColorStop(0.25, 'yellow');
            grad.addColorStop(0.5, 'green');
            grad.addColorStop(0.75, 'blue');
            grad.addColorStop(1, 'red');
            
            // Fill circle with conic gradient
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(100, 75, 60, 0, Math.PI * 2);
            ctx.fill();
            
            // Add border to show shape
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });

    // Test: Linear Gradient Strokes Test
    // This file will be concatenated into the main visual test suite

    registerVisualTest('linear-gradient-strokes', {
        name: 'Linear gradients applied to strokes - various shapes and styles',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Clear background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            // Create linear gradient for strokes
            const grad = ctx.createLinearGradient(0, 0, 300, 0);
            grad.addColorStop(0, 'red');
            grad.addColorStop(0.5, 'yellow');
            grad.addColorStop(1, 'blue');
            
            ctx.strokeStyle = grad;
            
            // Test: Simple line with different line caps
            ctx.lineWidth = 8;
            
            // Butt cap
            ctx.lineCap = 'butt';
            ctx.beginPath();
            ctx.moveTo(20, 30);
            ctx.lineTo(120, 30);
            ctx.stroke();
            
            // Round cap
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(140, 30);
            ctx.lineTo(240, 30);
            ctx.stroke();
            
            // Square cap
            ctx.lineCap = 'square';
            ctx.beginPath();
            ctx.moveTo(250, 30);
            ctx.lineTo(280, 30);
            ctx.stroke();
            
            // Test: Line joins with thick strokes
            ctx.lineWidth = 12;
            ctx.lineCap = 'butt';
            
            // Miter join
            ctx.lineJoin = 'miter';
            ctx.beginPath();
            ctx.moveTo(20, 60);
            ctx.lineTo(60, 80);
            ctx.lineTo(100, 60);
            ctx.stroke();
            
            // Round join
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(120, 60);
            ctx.lineTo(160, 80);
            ctx.lineTo(200, 60);
            ctx.stroke();
            
            // Bevel join
            ctx.lineJoin = 'bevel';
            ctx.beginPath();
            ctx.moveTo(220, 60);
            ctx.lineTo(260, 80);
            ctx.lineTo(280, 60);
            ctx.stroke();
            
            // Test: Different stroke widths
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            
            const widths = [2, 4, 8, 12];
            widths.forEach((width, i) => {
                ctx.lineWidth = width;
                ctx.beginPath();
                ctx.moveTo(20 + i * 60, 110);
                ctx.lineTo(60 + i * 60, 130);
                ctx.stroke();
            });
            
            // Test: Curved paths
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(20, 150);
            ctx.quadraticCurveTo(80, 120, 120, 150);
            ctx.bezierCurveTo(160, 180, 200, 120, 280, 150);
            ctx.stroke();
            
            // Test: Rectangle stroke
            ctx.lineWidth = 4;
            ctx.strokeRect(20, 170, 80, 20);
            
            // Test: Circle stroke  
            ctx.beginPath();
            ctx.arc(180, 180, 15, 0, Math.PI * 2);
            ctx.stroke();
        }
    });

    // Test: Radial Gradient Strokes Test
    // This file will be concatenated into the main visual test suite

    registerVisualTest('radial-gradient-strokes', {
        name: 'Radial gradients applied to strokes - various shapes',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Clear background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            // Create radial gradient for strokes
            const grad = ctx.createRadialGradient(150, 100, 10, 150, 100, 120);
            grad.addColorStop(0, 'yellow');
            grad.addColorStop(0.4, 'orange');
            grad.addColorStop(0.8, 'red');
            grad.addColorStop(1, 'darkred');
            
            ctx.strokeStyle = grad;
            
            // Test: Thick lines with different caps
            ctx.lineWidth = 10;
            
            ctx.lineCap = 'butt';
            ctx.beginPath();
            ctx.moveTo(20, 30);
            ctx.lineTo(100, 30);
            ctx.stroke();
            
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(120, 30);
            ctx.lineTo(200, 30);
            ctx.stroke();
            
            ctx.lineCap = 'square';
            ctx.beginPath();
            ctx.moveTo(220, 30);
            ctx.lineTo(280, 30);
            ctx.stroke();
            
            // Test: Star shape with miter joins
            ctx.lineWidth = 6;
            ctx.lineJoin = 'miter';
            ctx.lineCap = 'butt';
            
            ctx.beginPath();
            const centerX = 80, centerY = 80;
            const outerRadius = 25, innerRadius = 12;
            for (let i = 0; i < 10; i++) {
                const angle = (i * Math.PI) / 5;
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            ctx.stroke();
            
            // Test: Concentric circles
            ctx.lineWidth = 4;
            ctx.lineCap = 'butt';
            const radii = [15, 25, 35];
            radii.forEach(radius => {
                ctx.beginPath();
                ctx.arc(200, 80, radius, 0, Math.PI * 2);
                ctx.stroke();
            });
            
            // Test: Spiral
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(80, 140);
            for (let i = 0; i < 100; i++) {
                const angle = i * 0.2;
                const radius = i * 0.3;
                const x = 80 + Math.cos(angle) * radius;
                const y = 140 + Math.sin(angle) * radius;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
            
            // Test: Complex path with curves
            ctx.lineWidth = 8;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(180, 140);
            ctx.quadraticCurveTo(220, 120, 250, 140);
            ctx.quadraticCurveTo(270, 160, 250, 180);
            ctx.quadraticCurveTo(220, 200, 180, 180);
            ctx.quadraticCurveTo(160, 160, 180, 140);
            ctx.stroke();
        }
    });

    // Test: Conic Gradient Strokes Test
    // This file will be concatenated into the main visual test suite

    registerVisualTest('conic-gradient-strokes', {
        name: 'Conic gradients applied to strokes - various shapes',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Clear background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            // Create conic gradient for strokes (starting from top)
            const grad = ctx.createConicGradient(-Math.PI/2, 150, 100);
            grad.addColorStop(0, 'cyan');
            grad.addColorStop(0.2, 'blue');
            grad.addColorStop(0.4, 'purple');
            grad.addColorStop(0.6, 'red');
            grad.addColorStop(0.8, 'orange');
            grad.addColorStop(1, 'cyan');
            
            ctx.strokeStyle = grad;
            
            // Test: Rays emanating from center
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            
            for (let i = 0; i < 12; i++) {
                const angle = (i * Math.PI * 2) / 12;
                const startRadius = 20;
                const endRadius = 50;
                const startX = 80 + Math.cos(angle) * startRadius;
                const startY = 60 + Math.sin(angle) * startRadius;
                const endX = 80 + Math.cos(angle) * endRadius;
                const endY = 60 + Math.sin(angle) * endRadius;
                
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }
            
            // Test: Polygon with various joins
            ctx.lineWidth = 8;
            
            // Hexagon with miter joins
            ctx.lineJoin = 'miter';
            ctx.beginPath();
            for (let i = 0; i < 7; i++) {
                const angle = (i * Math.PI * 2) / 6;
                const x = 200 + Math.cos(angle) * 30;
                const y = 60 + Math.sin(angle) * 30;
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
            
            // Test: Wavy line
            ctx.lineWidth = 6;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            
            ctx.beginPath();
            ctx.moveTo(20, 120);
            for (let x = 20; x <= 280; x += 10) {
                const y = 120 + Math.sin((x - 20) * 0.05) * 20;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
            
            // Test: Figure-eight pattern
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(80, 160);
            ctx.bezierCurveTo(80, 140, 120, 140, 120, 160);
            ctx.bezierCurveTo(120, 180, 80, 180, 80, 160);
            ctx.bezierCurveTo(80, 140, 40, 140, 40, 160);
            ctx.bezierCurveTo(40, 180, 80, 180, 80, 160);
            ctx.stroke();
            
            // Test: Arc segments with different thickness
            const thicknesses = [2, 4, 6, 8];
            thicknesses.forEach((thickness, i) => {
                ctx.lineWidth = thickness;
                ctx.beginPath();
                const startAngle = (i * Math.PI) / 6;
                const endAngle = startAngle + Math.PI / 3;
                ctx.arc(220, 160, 25 + i * 5, startAngle, endAngle);
                ctx.stroke();
            });
        }
    });

    // Test: Gradient Strokes with Line Dashes Test
    // This file will be concatenated into the main visual test suite

    registerVisualTest('gradient-strokes-dashes', {
        name: 'All gradient types with dashed strokes - patterns and combinations',
        width: 320, height: 280,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Clear background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 320, 280);
            
            // Section 1: Linear gradient with dashes
            const linearGrad = ctx.createLinearGradient(0, 0, 300, 0);
            linearGrad.addColorStop(0, 'red');
            linearGrad.addColorStop(0.5, 'yellow');
            linearGrad.addColorStop(1, 'green');
            
            ctx.strokeStyle = linearGrad;
            ctx.lineWidth = 8;
            ctx.lineCap = 'butt';
            
            // Simple dash pattern
            ctx.setLineDash([15, 5]);
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            ctx.moveTo(20, 30);
            ctx.lineTo(300, 30);
            ctx.stroke();
            
            // Complex dash pattern
            ctx.setLineDash([10, 5, 2, 5]);
            ctx.beginPath();
            ctx.moveTo(20, 50);
            ctx.lineTo(300, 50);
            ctx.stroke();
            
            // Dashed curve
            ctx.setLineDash([8, 4]);
            ctx.beginPath();
            ctx.moveTo(20, 70);
            ctx.quadraticCurveTo(160, 40, 300, 70);
            ctx.stroke();
            
            // Section 2: Radial gradient with dashes
            const radialGrad = ctx.createRadialGradient(160, 130, 5, 160, 130, 80);
            radialGrad.addColorStop(0, 'white');
            radialGrad.addColorStop(0.3, 'cyan');
            radialGrad.addColorStop(0.7, 'blue');
            radialGrad.addColorStop(1, 'navy');
            
            ctx.strokeStyle = radialGrad;
            ctx.lineWidth = 6;
            
            // Dashed circle
            ctx.setLineDash([12, 8]);
            ctx.beginPath();
            ctx.arc(80, 130, 40, 0, Math.PI * 2);
            ctx.stroke();
            
            // Dashed spiral
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(160, 130);
            for (let i = 0; i < 120; i++) {
                const angle = i * 0.15;
                const radius = i * 0.25;
                const x = 160 + Math.cos(angle) * radius;
                const y = 130 + Math.sin(angle) * radius;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
            
            // Dashed star
            ctx.setLineDash([5, 3]);
            ctx.lineJoin = 'miter';
            ctx.beginPath();
            const centerX = 240, centerY = 130;
            const outerR = 30, innerR = 15;
            for (let i = 0; i < 10; i++) {
                const angle = (i * Math.PI) / 5;
                const radius = i % 2 === 0 ? outerR : innerR;
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            ctx.stroke();
            
            // Section 3: Conic gradient with dashes
            const conicGrad = ctx.createConicGradient(0, 160, 220);
            conicGrad.addColorStop(0, 'magenta');
            conicGrad.addColorStop(0.25, 'red');
            conicGrad.addColorStop(0.5, 'orange');
            conicGrad.addColorStop(0.75, 'yellow');
            conicGrad.addColorStop(1, 'magenta');
            
            ctx.strokeStyle = conicGrad;
            
            // Dashed wavy line
            ctx.lineWidth = 4;
            ctx.setLineDash([8, 3, 2, 3]);
            ctx.lineDashOffset = 5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(20, 200);
            for (let x = 20; x <= 300; x += 5) {
                const y = 200 + Math.sin((x - 20) * 0.03) * 15;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
            
            // Dashed polygon with different dash offsets
            const sides = 6;
            const polygonR = 25;
            const dashOffsets = [0, 3, 6, 9];
            
            dashOffsets.forEach((offset, i) => {
                ctx.setLineDash([6, 4]);
                ctx.lineDashOffset = offset;
                ctx.lineWidth = 3;
                ctx.beginPath();
                
                const centerX = 80 + i * 60;
                const centerY = 250;
                
                for (let j = 0; j < sides + 1; j++) {
                    const angle = (j * Math.PI * 2) / sides;
                    const x = centerX + Math.cos(angle) * polygonR;
                    const y = centerY + Math.sin(angle) * polygonR;
                    if (j === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.stroke();
            });
            
            // Reset dash pattern for any subsequent drawing
            ctx.setLineDash([]);
        }
    });

    // Test: Basic Line Dash Patterns with Sub-pixel Strokes
    // This file will be concatenated into the main visual test suite

    // Test 69
    registerVisualTest('line-dash-basic-patterns-subpixel', {
        name: 'Line dash - basic patterns with sub-pixel strokes',
        width: 300, height: 200,
        // Unified drawing function that works with both canvas types
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 0.5; // Sub-pixel width (50% opacity)
            
            // Test: Solid sub-pixel line (empty dash array)
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(20, 30);
            ctx.lineTo(280, 30);
            ctx.stroke();
            
            // Test: Simple dash pattern [5, 5] with sub-pixel width
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(20, 60);
            ctx.lineTo(280, 60);
            ctx.stroke();
            
            // Test: Long dash pattern [15, 5] with sub-pixel width
            ctx.setLineDash([15, 5]);
            ctx.beginPath();
            ctx.moveTo(20, 90);
            ctx.lineTo(280, 90);
            ctx.stroke();
            
            // Test: Change to even thinner stroke
            ctx.lineWidth = 0.25; // 25% opacity
            ctx.strokeStyle = 'blue';
            
            // Dot pattern [1, 3] - tiny dashes, larger gaps
            ctx.setLineDash([1, 3]);
            ctx.beginPath();
            ctx.moveTo(20, 120);
            ctx.lineTo(280, 120);
            ctx.stroke();
            
            // Test: Ultra-thin stroke
            ctx.lineWidth = 0.1; // 10% opacity  
            ctx.strokeStyle = 'green';
            
            // Complex pattern [10, 5, 2, 5] - varied dash/gap lengths
            ctx.setLineDash([10, 5, 2, 5]);
            ctx.beginPath();
            ctx.moveTo(20, 150);
            ctx.lineTo(280, 150);
            ctx.stroke();
            
            // Reset to solid for any additional drawing
            ctx.setLineDash([]);
        }
    });

    // Test: Line Dash Offset with Sub-pixel Strokes
    // This file will be concatenated into the main visual test suite

    // Test 70
    registerVisualTest('line-dash-offset-subpixel', {
        name: 'Line dash - offset behavior with sub-pixel strokes',
        width: 300, height: 250,
        // Unified drawing function that works with both canvas types
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 250);
            
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 0.6; // Sub-pixel width (60% opacity)
            
            // Use consistent dash pattern [20, 10] for all tests
            ctx.setLineDash([20, 10]);
            
            // Test: No offset (lineDashOffset = 0)
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            ctx.moveTo(50, 40);
            ctx.lineTo(250, 40);
            ctx.stroke();
            
            // Test: Small offset (lineDashOffset = 5)
            ctx.lineDashOffset = 5;
            ctx.beginPath();
            ctx.moveTo(50, 70);
            ctx.lineTo(250, 70);
            ctx.stroke();
            
            // Test: Half pattern offset (lineDashOffset = 15)
            ctx.lineDashOffset = 15;
            ctx.beginPath();
            ctx.moveTo(50, 100);
            ctx.lineTo(250, 100);
            ctx.stroke();
            
            // Test: Change to thinner stroke
            ctx.strokeStyle = 'purple';
            ctx.lineWidth = 0.3; // 30% opacity
            
            // Full dash length offset (lineDashOffset = 20)
            ctx.lineDashOffset = 20;
            ctx.beginPath();
            ctx.moveTo(50, 130);
            ctx.lineTo(250, 130);
            ctx.stroke();
            
            // Test: Greater than pattern length (lineDashOffset = 35, wraps around)
            ctx.lineDashOffset = 35;
            ctx.beginPath();
            ctx.moveTo(50, 160);
            ctx.lineTo(250, 160);
            ctx.stroke();
            
            // Test: Ultra-thin stroke with negative offset
            ctx.strokeStyle = 'green';  
            ctx.lineWidth = 0.15; // 15% opacity
            ctx.lineDashOffset = -10;
            ctx.beginPath();
            ctx.moveTo(50, 190);
            ctx.lineTo(250, 190);
            ctx.stroke();
            
            // Pattern reference at bottom (normal thickness for comparison)
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.setLineDash([20, 10]);
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            ctx.moveTo(50, 225);
            ctx.lineTo(250, 225);
            ctx.stroke();
            
            // Reset dash pattern
            ctx.setLineDash([]);
            ctx.lineDashOffset = 0;
        }
    });

    // Test: Line Dash with Complex Paths and Sub-pixel Strokes
    // This file will be concatenated into the main visual test suite

    // Test 71
    registerVisualTest('line-dash-complex-paths-subpixel', {
        name: 'Line dash - complex paths and shapes with sub-pixel strokes',
        width: 350, height: 300,
        // Unified drawing function that works with both canvas types
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 350, 300);
            
            // Test: Dashed rectangle with sub-pixel stroke
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 0.4; // 40% opacity
            ctx.setLineDash([8, 4]);
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            ctx.rect(20, 20, 80, 60);
            ctx.stroke();
            
            // Test: Dashed circle with thinner sub-pixel stroke
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 0.25; // 25% opacity
            ctx.setLineDash([5, 5]);
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            ctx.arc(180, 50, 35, 0, 2 * Math.PI);
            ctx.stroke();
            
            // Test: Dashed triangle with odd-length pattern and sub-pixel stroke
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 0.6; // 60% opacity
            ctx.setLineDash([12, 8, 4]); // Odd length - should duplicate to [12,8,4,12,8,4]
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            ctx.moveTo(280, 20);
            ctx.lineTo(330, 80);
            ctx.lineTo(230, 80);
            ctx.closePath();
            ctx.stroke();
            
            // Test: Dashed bezier curve with very thin stroke
            ctx.strokeStyle = 'purple';
            ctx.lineWidth = 0.15; // 15% opacity
            ctx.setLineDash([10, 5]);
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            ctx.moveTo(20, 120);
            ctx.bezierCurveTo(50, 90, 80, 150, 110, 120);
            ctx.stroke();
            
            // Test: Dashed quadratic curve with sub-pixel width
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 0.35; // 35% opacity
            ctx.setLineDash([6, 3]);
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            ctx.moveTo(130, 120);
            ctx.quadraticCurveTo(165, 90, 200, 120);
            ctx.stroke();
            
            // Test: Complex path with multiple segments, transforms, and sub-pixel stroke
            ctx.save();
            ctx.translate(250, 150);
            ctx.rotate(Math.PI / 6);
            ctx.strokeStyle = 'darkred';
            ctx.lineWidth = 0.5; // 50% opacity
            ctx.setLineDash([15, 5, 5, 5]);
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            ctx.moveTo(-30, -20);
            ctx.lineTo(30, -20);
            ctx.lineTo(40, 0);
            ctx.lineTo(30, 20);
            ctx.lineTo(-30, 20);
            ctx.lineTo(-40, 0);
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
            
            // Test: Star shape with ultra-thin dashed outline
            ctx.strokeStyle = 'darkgreen';
            ctx.lineWidth = 0.2; // 20% opacity
            ctx.setLineDash([4, 2]);
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            const cx = 60, cy = 220, outerRadius = 35, innerRadius = 15;
            for (let i = 0; i < 5; i++) {
                const outerAngle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                const innerAngle = ((i + 0.5) * 2 * Math.PI) / 5 - Math.PI / 2;
                
                const outerX = cx + outerRadius * Math.cos(outerAngle);
                const outerY = cy + outerRadius * Math.sin(outerAngle);
                const innerX = cx + innerRadius * Math.cos(innerAngle);
                const innerY = cy + innerRadius * Math.sin(innerAngle);
                
                if (i === 0) {
                    ctx.moveTo(outerX, outerY);
                } else {
                    ctx.lineTo(outerX, outerY);
                }
                ctx.lineTo(innerX, innerY);
            }
            ctx.closePath();
            ctx.stroke();
            
            // Test: Arc with sub-pixel dashed stroke
            ctx.strokeStyle = 'darkblue';
            ctx.lineWidth = 0.45; // 45% opacity
            ctx.setLineDash([12, 6]);
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            ctx.arc(180, 220, 40, 0.2 * Math.PI, 1.8 * Math.PI);
            ctx.stroke();
            
            // Reset dash patterns
            ctx.setLineDash([]);
            ctx.lineDashOffset = 0;
        }
    });

    // Test: Linear Gradient Strokes with Sub-pixel Width
    // This file will be concatenated into the main visual test suite

    registerVisualTest('linear-gradient-strokes-subpixel', {
        name: 'Linear gradients applied to sub-pixel strokes - various shapes and styles',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Clear background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            // Create linear gradient for strokes
            const grad = ctx.createLinearGradient(0, 0, 300, 0);
            grad.addColorStop(0, 'red');
            grad.addColorStop(0.5, 'yellow');
            grad.addColorStop(1, 'blue');
            
            ctx.strokeStyle = grad;
            
            // Test: Simple line with different line caps and sub-pixel width
            ctx.lineWidth = 0.6; // 60% opacity
            
            // Butt cap
            ctx.lineCap = 'butt';
            ctx.beginPath();
            ctx.moveTo(20, 30);
            ctx.lineTo(120, 30);
            ctx.stroke();
            
            // Round cap
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(140, 30);
            ctx.lineTo(240, 30);
            ctx.stroke();
            
            // Square cap
            ctx.lineCap = 'square';
            ctx.beginPath();
            ctx.moveTo(250, 30);
            ctx.lineTo(280, 30);
            ctx.stroke();
            
            // Test: Line joins with thin sub-pixel strokes
            ctx.lineWidth = 0.4; // 40% opacity
            ctx.lineCap = 'butt';
            
            // Miter join
            ctx.lineJoin = 'miter';
            ctx.beginPath();
            ctx.moveTo(20, 60);
            ctx.lineTo(60, 80);
            ctx.lineTo(100, 60);
            ctx.stroke();
            
            // Round join
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(120, 60);
            ctx.lineTo(160, 80);
            ctx.lineTo(200, 60);
            ctx.stroke();
            
            // Bevel join
            ctx.lineJoin = 'bevel';
            ctx.beginPath();
            ctx.moveTo(220, 60);
            ctx.lineTo(260, 80);
            ctx.lineTo(280, 60);
            ctx.stroke();
            
            // Test: Different sub-pixel stroke widths
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            
            const widths = [0.15, 0.3, 0.5, 0.75]; // All sub-pixel
            widths.forEach((width, i) => {
                ctx.lineWidth = width;
                ctx.beginPath();
                ctx.moveTo(20 + i * 60, 110);
                ctx.lineTo(60 + i * 60, 130);
                ctx.stroke();
            });
            
            // Test: Curved paths with ultra-thin stroke
            ctx.lineWidth = 0.25; // 25% opacity
            ctx.beginPath();
            ctx.moveTo(20, 150);
            ctx.quadraticCurveTo(80, 120, 120, 150);
            ctx.bezierCurveTo(160, 180, 200, 120, 280, 150);
            ctx.stroke();
            
            // Test: Rectangle stroke with sub-pixel width
            ctx.lineWidth = 0.35; // 35% opacity
            ctx.strokeRect(20, 170, 80, 20);
            
            // Test: Circle stroke with very thin width
            ctx.lineWidth = 0.2; // 20% opacity
            ctx.beginPath();
            ctx.arc(180, 180, 15, 0, Math.PI * 2);
            ctx.stroke();
        }
    });

    // Test: Radial Gradient Strokes with Sub-pixel Width
    // This file will be concatenated into the main visual test suite

    registerVisualTest('radial-gradient-strokes-subpixel', {
        name: 'Radial gradients applied to sub-pixel strokes - various shapes',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Clear background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            // Create radial gradient for strokes
            const grad = ctx.createRadialGradient(150, 100, 10, 150, 100, 120);
            grad.addColorStop(0, 'yellow');
            grad.addColorStop(0.4, 'orange');
            grad.addColorStop(0.8, 'red');
            grad.addColorStop(1, 'darkred');
            
            ctx.strokeStyle = grad;
            
            // Test: Thin sub-pixel lines with different caps
            ctx.lineWidth = 0.5; // 50% opacity
            
            ctx.lineCap = 'butt';
            ctx.beginPath();
            ctx.moveTo(20, 30);
            ctx.lineTo(100, 30);
            ctx.stroke();
            
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(120, 30);
            ctx.lineTo(200, 30);
            ctx.stroke();
            
            ctx.lineCap = 'square';
            ctx.beginPath();
            ctx.moveTo(220, 30);
            ctx.lineTo(280, 30);
            ctx.stroke();
            
            // Test: Star shape with ultra-thin sub-pixel stroke
            ctx.lineWidth = 0.3; // 30% opacity
            ctx.lineJoin = 'miter';
            ctx.lineCap = 'butt';
            
            ctx.beginPath();
            const centerX = 80, centerY = 80;
            const outerRadius = 25, innerRadius = 12;
            for (let i = 0; i < 10; i++) {
                const angle = (i * Math.PI) / 5;
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            ctx.stroke();
            
            // Test: Concentric circles with varying sub-pixel widths
            ctx.lineCap = 'butt';
            const radii = [15, 25, 35];
            const widths = [0.2, 0.35, 0.5]; // Different sub-pixel widths
            radii.forEach((radius, i) => {
                ctx.lineWidth = widths[i];
                ctx.beginPath();
                ctx.arc(200, 80, radius, 0, Math.PI * 2);
                ctx.stroke();
            });
            
            // Test: Spiral with very thin stroke
            ctx.lineWidth = 0.15; // 15% opacity - very thin
            ctx.beginPath();
            ctx.moveTo(80, 140);
            for (let i = 0; i < 100; i++) {
                const angle = i * 0.2;
                const radius = i * 0.3;
                const x = 80 + Math.cos(angle) * radius;
                const y = 140 + Math.sin(angle) * radius;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
            
            // Test: Complex path with curves and sub-pixel stroke
            ctx.lineWidth = 0.4; // 40% opacity
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(180, 140);
            ctx.quadraticCurveTo(220, 120, 250, 140);
            ctx.quadraticCurveTo(270, 160, 250, 180);
            ctx.quadraticCurveTo(220, 200, 180, 180);
            ctx.quadraticCurveTo(160, 160, 180, 140);
            ctx.stroke();
        }
    });

    // Test: Conic Gradient Strokes with Sub-pixel Width
    // This file will be concatenated into the main visual test suite

    registerVisualTest('conic-gradient-strokes-subpixel', {
        name: 'Conic gradients applied to sub-pixel strokes - various shapes',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Clear background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            // Create conic gradient for strokes (starting from top)
            const grad = ctx.createConicGradient(-Math.PI/2, 150, 100);
            grad.addColorStop(0, 'cyan');
            grad.addColorStop(0.2, 'blue');
            grad.addColorStop(0.4, 'purple');
            grad.addColorStop(0.6, 'red');
            grad.addColorStop(0.8, 'orange');
            grad.addColorStop(1, 'cyan');
            
            ctx.strokeStyle = grad;
            
            // Test: Rays emanating from center with sub-pixel strokes
            ctx.lineWidth = 0.3; // 30% opacity
            ctx.lineCap = 'round';
            
            for (let i = 0; i < 12; i++) {
                const angle = (i * Math.PI * 2) / 12;
                const startRadius = 20;
                const endRadius = 50;
                const startX = 80 + Math.cos(angle) * startRadius;
                const startY = 60 + Math.sin(angle) * startRadius;
                const endX = 80 + Math.cos(angle) * endRadius;
                const endY = 60 + Math.sin(angle) * endRadius;
                
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }
            
            // Test: Polygon with various joins and sub-pixel width
            ctx.lineWidth = 0.6; // 60% opacity
            
            // Hexagon with miter joins
            ctx.lineJoin = 'miter';
            ctx.beginPath();
            for (let i = 0; i < 7; i++) {
                const angle = (i * Math.PI * 2) / 6;
                const x = 200 + Math.cos(angle) * 30;
                const y = 60 + Math.sin(angle) * 30;
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
            
            // Test: Wavy line with thin sub-pixel stroke
            ctx.lineWidth = 0.25; // 25% opacity
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            
            ctx.beginPath();
            ctx.moveTo(20, 120);
            for (let x = 20; x <= 280; x += 10) {
                const y = 120 + Math.sin((x - 20) * 0.05) * 20;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
            
            // Test: Figure-eight pattern with sub-pixel width
            ctx.lineWidth = 0.4; // 40% opacity
            ctx.beginPath();
            ctx.moveTo(80, 160);
            ctx.bezierCurveTo(80, 140, 120, 140, 120, 160);
            ctx.bezierCurveTo(120, 180, 80, 180, 80, 160);
            ctx.bezierCurveTo(80, 140, 40, 140, 40, 160);
            ctx.bezierCurveTo(40, 180, 80, 180, 80, 160);
            ctx.stroke();
            
            // Test: Arc segments with different sub-pixel thicknesses
            const thicknesses = [0.15, 0.3, 0.45, 0.6]; // All sub-pixel
            thicknesses.forEach((thickness, i) => {
                ctx.lineWidth = thickness;
                ctx.beginPath();
                const startAngle = (i * Math.PI) / 6;
                const endAngle = startAngle + Math.PI / 3;
                ctx.arc(220, 160, 25 + i * 5, startAngle, endAngle);
                ctx.stroke();
            });
        }
    });

    // Test: Gradient Strokes with Line Dashes and Sub-pixel Width
    // This file will be concatenated into the main visual test suite

    registerVisualTest('gradient-strokes-dashes-subpixel', {
        name: 'All gradient types with dashed sub-pixel strokes - patterns and combinations',
        width: 320, height: 280,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Clear background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 320, 280);
            
            // Section 1: Linear gradient with dashes and sub-pixel strokes
            const linearGrad = ctx.createLinearGradient(0, 0, 300, 0);
            linearGrad.addColorStop(0, 'red');
            linearGrad.addColorStop(0.5, 'yellow');
            linearGrad.addColorStop(1, 'green');
            
            ctx.strokeStyle = linearGrad;
            ctx.lineWidth = 0.5; // 50% opacity
            ctx.lineCap = 'butt';
            
            // Simple dash pattern
            ctx.setLineDash([15, 5]);
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            ctx.moveTo(20, 30);
            ctx.lineTo(300, 30);
            ctx.stroke();
            
            // Complex dash pattern with thinner stroke
            ctx.lineWidth = 0.3; // 30% opacity
            ctx.setLineDash([10, 5, 2, 5]);
            ctx.beginPath();
            ctx.moveTo(20, 50);
            ctx.lineTo(300, 50);
            ctx.stroke();
            
            // Dashed curve with ultra-thin stroke
            ctx.lineWidth = 0.2; // 20% opacity
            ctx.setLineDash([8, 4]);
            ctx.beginPath();
            ctx.moveTo(20, 70);
            ctx.quadraticCurveTo(160, 40, 300, 70);
            ctx.stroke();
            
            // Section 2: Radial gradient with dashes and sub-pixel strokes
            const radialGrad = ctx.createRadialGradient(160, 130, 5, 160, 130, 80);
            radialGrad.addColorStop(0, 'white');
            radialGrad.addColorStop(0.3, 'cyan');
            radialGrad.addColorStop(0.7, 'blue');
            radialGrad.addColorStop(1, 'navy');
            
            ctx.strokeStyle = radialGrad;
            ctx.lineWidth = 0.4; // 40% opacity
            
            // Dashed circle
            ctx.setLineDash([12, 8]);
            ctx.beginPath();
            ctx.arc(80, 130, 40, 0, Math.PI * 2);
            ctx.stroke();
            
            // Dashed spiral with very thin stroke
            ctx.lineWidth = 0.25; // 25% opacity
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(160, 130);
            for (let i = 0; i < 120; i++) {
                const angle = i * 0.15;
                const radius = i * 0.25;
                const x = 160 + Math.cos(angle) * radius;
                const y = 130 + Math.sin(angle) * radius;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
            
            // Dashed star with sub-pixel stroke
            ctx.lineWidth = 0.35; // 35% opacity
            ctx.setLineDash([5, 3]);
            ctx.lineJoin = 'miter';
            ctx.beginPath();
            const centerX = 240, centerY = 130;
            const outerR = 30, innerR = 15;
            for (let i = 0; i < 10; i++) {
                const angle = (i * Math.PI) / 5;
                const radius = i % 2 === 0 ? outerR : innerR;
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            ctx.stroke();
            
            // Section 3: Conic gradient with dashes and sub-pixel strokes
            const conicGrad = ctx.createConicGradient(0, 160, 220);
            conicGrad.addColorStop(0, 'magenta');
            conicGrad.addColorStop(0.25, 'red');
            conicGrad.addColorStop(0.5, 'orange');
            conicGrad.addColorStop(0.75, 'yellow');
            conicGrad.addColorStop(1, 'magenta');
            
            ctx.strokeStyle = conicGrad;
            
            // Dashed wavy line with thin sub-pixel stroke
            ctx.lineWidth = 0.3; // 30% opacity
            ctx.setLineDash([8, 3, 2, 3]);
            ctx.lineDashOffset = 5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(20, 200);
            for (let x = 20; x <= 300; x += 5) {
                const y = 200 + Math.sin((x - 20) * 0.03) * 15;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
            
            // Dashed polygon with different dash offsets and varying sub-pixel widths
            const sides = 6;
            const polygonR = 25;
            const dashOffsets = [0, 3, 6, 9];
            const subPixelWidths = [0.15, 0.25, 0.35, 0.45]; // Different opacity levels
            
            dashOffsets.forEach((offset, i) => {
                ctx.setLineDash([6, 4]);
                ctx.lineDashOffset = offset;
                ctx.lineWidth = subPixelWidths[i];
                ctx.beginPath();
                
                const centerX = 80 + i * 60;
                const centerY = 250;
                
                for (let j = 0; j < sides + 1; j++) {
                    const angle = (j * Math.PI * 2) / sides;
                    const x = centerX + Math.cos(angle) * polygonR;
                    const y = centerY + Math.sin(angle) * polygonR;
                    if (j === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.stroke();
            });
            
            // Reset dash pattern for any subsequent drawing
            ctx.setLineDash([]);
        }
    });

    // Test: Thick Polyline Bevel Joins - Systematic Angle and Dash Combinations
    // This file will be concatenated into the main visual test suite

    registerVisualTest('thick-polyline-bevel-joins-systematic', {
        name: 'Thick Polyline - Bevel Joins with Angles and Dash Patterns',
        width: 600, height: 550,
        // Unified drawing function that works with both canvas types
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 600, 550);
            
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 12;  // Thick lines to show joins clearly
            ctx.lineJoin = 'bevel';
            ctx.lineCap = 'butt';
            
            // Test different angles and dash patterns
            const angles = [45, 90, 120, 135]; // Different angles between line segments
            const dashPatterns = [
                { name: 'No Dash', pattern: [] },
                { name: 'Thin Dash', pattern: [3, 3] },
                { name: 'Medium Dash', pattern: [8, 6] },
                { name: 'Thick Dash', pattern: [15, 10] }
            ];
            
            let yOffset = 40;
            
            // Draw each angle with each dash pattern
            for (let angleIndex = 0; angleIndex < angles.length; angleIndex++) {
                const angle = angles[angleIndex];
                let xOffset = 50;
                
                for (let dashIndex = 0; dashIndex < dashPatterns.length; dashIndex++) {
                    const dash = dashPatterns[dashIndex];
                    
                    // Set dash pattern
                    ctx.setLineDash(dash.pattern);
                    ctx.lineDashOffset = 0;
                    
                    // Calculate line segments based on angle
                    const segmentLength = 60;
                    const startX = xOffset;
                    const startY = yOffset;
                    const midX = startX + segmentLength;
                    const midY = startY;
                    
                    // Calculate end point based on angle
                    const angleRad = (angle * Math.PI) / 180;
                    const endX = midX + segmentLength * Math.cos(angleRad);
                    const endY = midY + segmentLength * Math.sin(angleRad);
                    
                    // Draw the polyline
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(midX, midY);
                    ctx.lineTo(endX, endY);
                    ctx.stroke();
                    
                    // Label the test (skip fillText for Core API compatibility)
                    ctx.save();
                    ctx.setLineDash([]);
                    ctx.fillStyle = 'black';
                    // Note: Using small marker dots instead of text for Core API compatibility
                    ctx.fillRect(startX + segmentLength/2 - 2, startY - 20, 4, 4);
                    ctx.restore();
                    
                    xOffset += 130;
                }
                
                yOffset += 90;
            }
            
            // Add additional complex polylines with multiple segments
            yOffset += 20;
            ctx.strokeStyle = 'red';
            
            // Complex zigzag with different dash patterns
            const dashPatternsComplex = [[], [5, 5], [12, 8]];
            let xStart = 50;
            
            for (let i = 0; i < dashPatternsComplex.length; i++) {
                ctx.setLineDash(dashPatternsComplex[i]);
                
                ctx.beginPath();
                ctx.moveTo(xStart, yOffset);
                ctx.lineTo(xStart + 40, yOffset - 30);
                ctx.lineTo(xStart + 80, yOffset);
                ctx.lineTo(xStart + 120, yOffset - 30);
                ctx.lineTo(xStart + 160, yOffset);
                ctx.stroke();
                
                xStart += 180;
            }
            
            // Reset line dash for any subsequent drawing
            ctx.setLineDash([]);
        }
    });

    // Test: Thick Polyline Miter Joins - Systematic Angle and Dash Combinations
    // This file will be concatenated into the main visual test suite

    registerVisualTest('thick-polyline-miter-joins-systematic', {
        name: 'Thick Polyline - Miter Joins with Angles and Dash Patterns',
        width: 600, height: 500,
        // Unified drawing function that works with both canvas types
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 600, 500);
            
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 12;  // Thick lines to show joins clearly
            ctx.lineJoin = 'miter';
            ctx.lineCap = 'butt';
            ctx.miterLimit = 10;  // Standard miter limit
            
            // Test different angles and dash patterns
            const angles = [30, 60, 90, 120]; // Different angles - some will show miter limits
            const dashPatterns = [
                { name: 'No Dash', pattern: [] },
                { name: 'Thin Dash', pattern: [4, 4] },
                { name: 'Medium Dash', pattern: [10, 7] },
                { name: 'Thick Dash', pattern: [18, 12] }
            ];
            
            let yOffset = 40;
            
            // Draw each angle with each dash pattern
            for (let angleIndex = 0; angleIndex < angles.length; angleIndex++) {
                const angle = angles[angleIndex];
                let xOffset = 50;
                
                for (let dashIndex = 0; dashIndex < dashPatterns.length; dashIndex++) {
                    const dash = dashPatterns[dashIndex];
                    
                    // Set dash pattern
                    ctx.setLineDash(dash.pattern);
                    ctx.lineDashOffset = 0;
                    
                    // Calculate line segments based on angle
                    const segmentLength = 55;
                    const startX = xOffset;
                    const startY = yOffset;
                    const midX = startX + segmentLength;
                    const midY = startY;
                    
                    // Calculate end point based on angle
                    const angleRad = (angle * Math.PI) / 180;
                    const endX = midX + segmentLength * Math.cos(angleRad);
                    const endY = midY + segmentLength * Math.sin(angleRad);
                    
                    // Draw the polyline
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(midX, midY);
                    ctx.lineTo(endX, endY);
                    ctx.stroke();
                    
                    // Label the test (skip fillText for Core API compatibility)
                    ctx.save();
                    ctx.setLineDash([]);
                    ctx.fillStyle = 'black';
                    // Note: Using small marker dots instead of text for Core API compatibility
                    ctx.fillRect(startX + segmentLength/2 - 2, startY - 20, 4, 4);
                    ctx.restore();
                    
                    xOffset += 130;
                }
                
                yOffset += 90;
            }
            
            // Add sharp angle tests to show miter limit behavior
            yOffset += 15;
            ctx.strokeStyle = 'darkred';
            
            // Very sharp angles that should hit miter limit
            const sharpAngles = [15, 10, 5]; // Very sharp angles
            let xStart = 80;
            
            for (let i = 0; i < sharpAngles.length; i++) {
                const angle = sharpAngles[i];
                const dashPattern = i === 0 ? [] : i === 1 ? [6, 6] : [12, 8];
                
                ctx.setLineDash(dashPattern);
                
                const segmentLength = 50;
                const angleRad = (angle * Math.PI) / 180;
                
                ctx.beginPath();
                ctx.moveTo(xStart, yOffset);
                ctx.lineTo(xStart + segmentLength, yOffset);
                ctx.lineTo(xStart + segmentLength + segmentLength * Math.cos(angleRad), 
                          yOffset + segmentLength * Math.sin(angleRad));
                ctx.stroke();
                
                // Label sharp angle test (skip fillText for Core API compatibility)
                ctx.save();
                ctx.setLineDash([]);
                ctx.fillStyle = 'red';
                // Note: Using colored marker dots to distinguish sharp angle tests
                ctx.fillRect(xStart + segmentLength/2 - 2, yOffset - 20, 4, 4);
                ctx.restore();
                
                xStart += 160;
            }
            
            // Reset line dash for any subsequent drawing
            ctx.setLineDash([]);
        }
    });

    // Test: Thick Polyline Round Joins - Systematic Angle and Dash Combinations
    // This file will be concatenated into the main visual test suite

    registerVisualTest('thick-polyline-round-joins-systematic', {
        name: 'Thick Polyline - Round Joins with Angles and Dash Patterns',
        width: 600, height: 500,
        // Unified drawing function that works with both canvas types
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 600, 500);
            
            ctx.strokeStyle = 'purple';
            ctx.lineWidth = 12;  // Thick lines to show joins clearly
            ctx.lineJoin = 'round';
            ctx.lineCap = 'butt';
            
            // Test different angles and dash patterns
            const angles = [45, 90, 135, 160]; // Different angles to show round join curves
            const dashPatterns = [
                { name: 'No Dash', pattern: [] },
                { name: 'Thin Dash', pattern: [3, 5] },
                { name: 'Medium Dash', pattern: [9, 8] },
                { name: 'Thick Dash', pattern: [16, 11] }
            ];
            
            let yOffset = 40;
            
            // Draw each angle with each dash pattern
            for (let angleIndex = 0; angleIndex < angles.length; angleIndex++) {
                const angle = angles[angleIndex];
                let xOffset = 50;
                
                for (let dashIndex = 0; dashIndex < dashPatterns.length; dashIndex++) {
                    const dash = dashPatterns[dashIndex];
                    
                    // Set dash pattern
                    ctx.setLineDash(dash.pattern);
                    ctx.lineDashOffset = 0;
                    
                    // Calculate line segments based on angle
                    const segmentLength = 55;
                    const startX = xOffset;
                    const startY = yOffset;
                    const midX = startX + segmentLength;
                    const midY = startY;
                    
                    // Calculate end point based on angle
                    const angleRad = (angle * Math.PI) / 180;
                    const endX = midX + segmentLength * Math.cos(angleRad);
                    const endY = midY + segmentLength * Math.sin(angleRad);
                    
                    // Draw the polyline
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(midX, midY);
                    ctx.lineTo(endX, endY);
                    ctx.stroke();
                    
                    // Label the test (skip fillText for Core API compatibility)
                    ctx.save();
                    ctx.setLineDash([]);
                    ctx.fillStyle = 'black';
                    // Note: Using small marker dots instead of text for Core API compatibility
                    ctx.fillRect(startX + segmentLength/2 - 2, startY - 20, 4, 4);
                    ctx.restore();
                    
                    xOffset += 130;
                }
                
                yOffset += 90;
            }
            
            // Add complex multi-segment polylines to show multiple round joins
            yOffset += 15;
            ctx.strokeStyle = 'darkorange';
            
            // Complex star-like pattern with round joins
            const dashPatternsComplex = [[], [7, 7], [14, 9]];
            let xStart = 80;
            
            for (let i = 0; i < dashPatternsComplex.length; i++) {
                ctx.setLineDash(dashPatternsComplex[i]);
                
                // Create a star-like pattern with multiple round joins
                const centerX = xStart + 40;
                const centerY = yOffset;
                const points = 5;
                const outerRadius = 35;
                const innerRadius = 15;
                
                ctx.beginPath();
                for (let p = 0; p < points * 2; p++) {
                    const angle = (p * Math.PI) / points;
                    const radius = p % 2 === 0 ? outerRadius : innerRadius;
                    const x = centerX + radius * Math.cos(angle - Math.PI / 2);
                    const y = centerY + radius * Math.sin(angle - Math.PI / 2);
                    
                    if (p === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.closePath();
                ctx.stroke();
                
                // Label complex pattern (skip fillText for Core API compatibility)
                ctx.save();
                ctx.setLineDash([]);
                const colors = ['black', 'blue', 'green'];
                ctx.fillStyle = colors[i];
                // Note: Using colored marker dots to identify different star patterns
                ctx.fillRect(centerX - 2, centerY + 45, 4, 4);
                ctx.restore();
                
                xStart += 160;
            }
            
            // Reset line dash for any subsequent drawing
            ctx.setLineDash([]);
        }
    });

    // Test: source-over Composite Operation
    // Visual test of the source-over composite operation (default behavior)

    registerVisualTest('composite-source-over', {
        name: 'Composite Operation: source-over (default)',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background for visibility
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            // Title indicator
            ctx.fillStyle = '#333';
            ctx.fillRect(10, 10, 100, 15);
            
            // Draw red circle (destination)
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#FF0000';
            ctx.beginPath();
            ctx.arc(100, 100, 40, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw blue square with source-over (should appear on top)
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#0000FF';
            ctx.fillRect(120, 80, 60, 40);
            
            // Expected result: Blue square appears on top of red circle
            // Overlap area should be blue
        }
    });

    // Test: destination-over Composite Operation
    // Visual test of the destination-over composite operation

    registerVisualTest('composite-destination-over', {
        name: 'Composite Operation: destination-over',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Gray background to distinguish transparent areas
            ctx.fillStyle = '#F0F0F0';
            ctx.fillRect(0, 0, 300, 200);
            
            // Title indicator 
            ctx.fillStyle = '#333';
            ctx.fillRect(10, 10, 150, 15);
            
            // Left example: Basic destination-over behavior
            // Clear area to create transparency
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'black'; // color doesn't matter
            ctx.fillRect(40, 40, 100, 80);
            
            // Draw blue rectangle (destination)
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#3366FF';
            ctx.fillRect(60, 50, 40, 40);
            
            // Draw red circle with destination-over (goes behind blue, fills transparent)
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = '#FF3333';
            ctx.beginPath();
            ctx.arc(80, 70, 30, 0, Math.PI * 2);
            ctx.fill();
            
            // Right example: destination-over with semi-transparent shapes
            // Clear area for second demo
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'black';
            ctx.fillRect(170, 40, 120, 100);
            
            // Draw semi-transparent yellow rectangle (destination)
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = '#FFFF00';
            ctx.fillRect(190, 60, 50, 30);
            
            // Draw semi-transparent purple circle with destination-over
            ctx.globalCompositeOperation = 'destination-over';
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = '#9933FF';
            ctx.beginPath();
            ctx.arc(230, 90, 35, 0, Math.PI * 2);
            ctx.fill();
            
            // Reset alpha
            ctx.globalAlpha = 1.0;
            
            // Expected result:
            // Left: Red circle visible behind blue rectangle and in transparent areas
            // Right: Purple circle behind yellow rectangle with alpha blending
        }
    });

    // Test: destination-out Composite Operation
    // Visual test of the destination-out composite operation

    registerVisualTest('composite-destination-out', {
        name: 'Composite Operation: destination-out',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background for visibility
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            // Title indicator
            ctx.fillStyle = '#333';
            ctx.fillRect(10, 10, 120, 15);
            
            // Draw red circle (destination)
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#FF0000';
            ctx.beginPath();
            ctx.arc(100, 100, 40, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw blue square with destination-out (should erase red where blue overlaps)
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = '#0000FF';
            ctx.fillRect(120, 80, 60, 40);
            
            // Expected result: Red circle with a rectangular hole cut out
            // Where blue square overlaps, red should be erased (transparent)
        }
    });

    // Test: xor Composite Operation
    // Visual test of the xor composite operation

    registerVisualTest('composite-xor', {
        name: 'Composite Operation: xor',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Light gray background for visibility
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, 300, 200);
            
            // Title indicator
            ctx.fillStyle = '#333';
            ctx.fillRect(10, 10, 80, 15);
            
            // Clear an area to demonstrate XOR on transparent background
            ctx.clearRect(50, 50, 200, 100);
            
            // Draw red circle on transparent area
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#FF0000';
            ctx.beginPath();
            ctx.arc(120, 100, 35, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw blue square with xor
            ctx.globalCompositeOperation = 'xor';
            ctx.fillStyle = '#0000FF';
            ctx.fillRect(140, 80, 50, 40);
            
            // Second example: XOR over opaque background to show cancellation
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'yellow';
            ctx.fillRect(50, 160, 40, 30);
            
            ctx.globalCompositeOperation = 'xor';
            ctx.fillStyle = 'purple';
            ctx.fillRect(70, 170, 40, 30);
            
            // Expected result: Red circle and blue square visible with transparent overlap (top),
            // yellow/purple cancellation creates holes (bottom)
        }
    });

    // Test: Composite Operation: destination-atop - destination visible only where source exists
    // This test demonstrates the global compositing fix for destination-atop

    registerVisualTest('composite-destination-atop', {
        name: 'Composite Operation: destination-atop - global effect',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            // Draw blue rectangle as destination
            ctx.fillStyle = '#0066ff';
            ctx.fillRect(50, 50, 100, 100);
            
            // Switch to destination-atop and draw red circle
            // This should keep the blue only where the red circle overlaps
            // and erase blue outside the circle (the key global effect)
            ctx.globalCompositeOperation = 'destination-atop';
            ctx.fillStyle = '#ff0066';
            ctx.beginPath();
            ctx.arc(120, 80, 40, 0, Math.PI * 2);
            ctx.fill();
            
            // Add label rectangles for clarity (using rectangles instead of text)
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'black';
            ctx.fillRect(10, 15, 5, 5); // Marker for destination-atop test
            
            // Show a comparison: draw the same shapes with source-over
            ctx.fillStyle = '#0066ff';
            ctx.fillRect(200, 50, 100, 100);
            
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#ff0066';
            ctx.beginPath();
            ctx.arc(270, 80, 40, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = 'black';
            ctx.fillRect(210, 165, 5, 5); // Marker for source-over comparison
        }
    });

    // Test: Composite Operation: destination-in - destination visible only where source exists
    // This test demonstrates the global compositing fix for destination-in

    registerVisualTest('composite-destination-in', {
        name: 'Composite Operation: destination-in - global effect',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            // Draw green rectangle as destination
            ctx.fillStyle = '#00cc66';
            ctx.fillRect(50, 50, 100, 100);
            
            // Switch to destination-in and draw blue triangle
            // This should keep the green only where the blue triangle overlaps
            // and erase green outside the triangle (the key global effect)
            ctx.globalCompositeOperation = 'destination-in';
            ctx.fillStyle = '#3366ff';
            ctx.beginPath();
            ctx.moveTo(100, 60);
            ctx.lineTo(140, 140);
            ctx.lineTo(60, 140);
            ctx.closePath();
            ctx.fill();
            
            // Add labels for clarity
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'black';
            
            // Show a comparison: draw the same shapes with source-over
            ctx.fillStyle = '#00cc66';
            ctx.fillRect(200, 50, 100, 100);
            
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#3366ff';
            ctx.beginPath();
            ctx.moveTo(250, 60);
            ctx.lineTo(290, 140);
            ctx.lineTo(210, 140);
            ctx.closePath();
            ctx.fill();
            
            ctx.fillStyle = 'black';
        }
    });

    // Test: Composite Operation: source-atop - source drawn only where destination exists
    // This test demonstrates the source-atop operation (already worked but now optimized)

    registerVisualTest('composite-source-atop', {
        name: 'Composite Operation: source-atop - masking effect',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            // Draw purple oval as destination
            ctx.fillStyle = '#9966cc';
            ctx.save();
            ctx.translate(100, 100);
            ctx.scale(2, 1);
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            
            // Switch to source-atop and draw orange rectangle
            // This should draw orange only where purple exists
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = '#ff9933';
            ctx.fillRect(60, 70, 80, 60);
            
            // Add labels for clarity
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'black';
            
            // Show a comparison: draw the same shapes with source-over
            ctx.fillStyle = '#9966cc';
            ctx.save();
            ctx.translate(250, 100);
            ctx.scale(2, 1);
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#ff9933';
            ctx.fillRect(210, 70, 80, 60);
            
            ctx.fillStyle = 'black';
        }
    });

    // Test: Composite Operation: source-in - source visible only where destination exists
    // This test demonstrates the source-in operation with global compositing improvements

    registerVisualTest('composite-source-in', {
        name: 'Composite Operation: source-in - masking effect',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            // Draw cyan star as destination
            ctx.fillStyle = '#00cccc';
            ctx.beginPath();
            // Draw 5-point star
            const cx = 100, cy = 100, r1 = 35, r2 = 15;
            for (let i = 0; i < 10; i++) {
                const angle = (i * Math.PI) / 5;
                const r = i % 2 === 0 ? r1 : r2;
                const x = cx + r * Math.cos(angle - Math.PI / 2);
                const y = cy + r * Math.sin(angle - Math.PI / 2);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            
            // Switch to source-in and draw red rectangle
            // This should show red only where cyan star exists
            ctx.globalCompositeOperation = 'source-in';
            ctx.fillStyle = '#ff3333';
            ctx.fillRect(70, 80, 60, 40);
            
            // Add labels for clarity
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'black';
            
            // Show a comparison: draw the same shapes with source-over
            ctx.fillStyle = '#00cccc';
            ctx.beginPath();
            // Draw 5-point star
            const cx2 = 250, cy2 = 100;
            for (let i = 0; i < 10; i++) {
                const angle = (i * Math.PI) / 5;
                const r = i % 2 === 0 ? r1 : r2;
                const x = cx2 + r * Math.cos(angle - Math.PI / 2);
                const y = cy2 + r * Math.sin(angle - Math.PI / 2);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#ff3333';
            ctx.fillRect(220, 80, 60, 40);
            
            ctx.fillStyle = 'black';
        }
    });

    // Test: Composite Operation: source-out - source visible only where destination doesn't exist
    // This test demonstrates the source-out operation with global compositing improvements

    registerVisualTest('composite-source-out', {
        name: 'Composite Operation: source-out - inverse masking',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            // Draw yellow hexagon as destination
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            const cx = 100, cy = 100, r = 30;
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI) / 3;
                const x = cx + r * Math.cos(angle);
                const y = cy + r * Math.sin(angle);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            
            // Switch to source-out and draw magenta circle
            // This should show magenta only where yellow hexagon doesn't exist
            ctx.globalCompositeOperation = 'source-out';
            ctx.fillStyle = '#ff00cc';
            ctx.beginPath();
            ctx.arc(100, 100, 45, 0, Math.PI * 2);
            ctx.fill();
            
            // Add labels for clarity
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'black';
            
            // Show a comparison: draw the same shapes with source-over
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            const cx2 = 250, cy2 = 100;
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI) / 3;
                const x = cx2 + r * Math.cos(angle);
                const y = cy2 + r * Math.sin(angle);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#ff00cc';
            ctx.beginPath();
            ctx.arc(250, 100, 45, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = 'black';
        }
    });

    // Test: Composite Operation: copy - source replaces destination completely  
    // This test demonstrates the copy operation with global compositing improvements

    registerVisualTest('composite-copy', {
        name: 'Composite Operation: copy - complete replacement',
        width: 300, height: 200,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 300, 200);
            
            // Draw teal background rectangle as destination
            ctx.fillStyle = '#008080';
            ctx.fillRect(40, 40, 120, 120);
            
            // Switch to copy and draw pink diamond
            // This should completely replace the teal with pink where the diamond is
            // and erase teal where diamond doesn't exist (within the drawing region)
            ctx.globalCompositeOperation = 'copy';
            ctx.fillStyle = '#ff69b4';
            ctx.save();
            ctx.translate(100, 100);
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-25, -25, 50, 50);
            ctx.restore();
            
            // Add labels for clarity
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'black';
            
            // Show a comparison: draw the same shapes with source-over
            ctx.fillStyle = '#008080';
            ctx.fillRect(190, 40, 120, 120);
            
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#ff69b4';
            ctx.save();
            ctx.translate(250, 100);
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-25, -25, 50, 50);
            ctx.restore();
            
            ctx.fillStyle = 'black';
            
            // Additional test: copy with transparency
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'rgba(128, 0, 128, 0.7)';
            ctx.fillRect(10, 160, 40, 30);
            
            ctx.globalCompositeOperation = 'copy';
            ctx.fillStyle = 'rgba(255, 165, 0, 0.5)';
            ctx.fillRect(20, 170, 20, 10);
            
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'black';
        }
    });

    // Test: Simple XOR Debug Test - Blue Square + Red Circle
    // This test creates a simple XOR case to debug the purple rectangle issue

    registerVisualTest('simple-xor-debug', {
        name: 'Simple XOR Debug Test - Blue Square + Red Circle',
        width: 200, height: 150,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 150);
            
            // Draw blue square as destination
            ctx.fillStyle = 'blue';
            ctx.fillRect(50, 40, 60, 60);
            
            // Switch to XOR and draw red circle
            ctx.globalCompositeOperation = 'xor';
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(100, 70, 35, 0, Math.PI * 2);
            ctx.fill();
            
            // Expected result:
            // - Blue square only areas: should be blue
            // - Red circle only areas: should be red  
            // - Overlap areas: should be transparent (white background shows through)
            // - Background: should remain white
        }
    });

    // Test: Minimal XOR Corner Test - Blue Square + Red Circle Corner Overlap
    // This is a truly minimal XOR test with clear corner overlap

    registerVisualTest('minimal-xor-corner', {
        name: 'Minimal XOR Corner Test - Blue Square + Red Circle Corner Overlap',
        width: 150, height: 150,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 150, 150);
            
            // Draw blue square as destination
            ctx.fillStyle = 'blue';
            ctx.fillRect(30, 30, 60, 60);  // Blue square from (30,30) to (90,90)
            
            // Switch to XOR and draw red circle overlapping top-right corner
            ctx.globalCompositeOperation = 'xor';
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(75, 45, 25, 0, Math.PI * 2);  // Red circle center (75,45), radius 25
            ctx.fill();
            
            // Expected result:
            // - Blue square areas not covered by circle: blue
            // - Red circle areas not covering the square: red
            // - Overlap area (top-right corner): transparent (white background shows)
            // - Background: white
            //
            // The circle center (75,45) with radius 25 covers roughly (50,20) to (100,70)
            // The square covers (30,30) to (90,90)  
            // Overlap should be roughly (50,30) to (90,70)
        }
    });

    // Test: Source-atop minimal test - classic blue square with red circle
    // Demonstrates that source-atop only draws where destination exists

    registerVisualTest('source-atop-minimal', {
        name: 'Source-atop minimal - blue square then red circle with source-atop',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Draw blue square as destination (55x55 at position 5,5)
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            
            // Apply source-atop composite operation
            ctx.globalCompositeOperation = 'source-atop';
            
            // Draw red circle centered at (65,65) with radius 32
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            
            // Expected result:
            // - Red appears only where it overlaps the blue square
            // - Outside the blue square, red should not appear
            // - Blue square remains blue where red doesn't overlap
        }
    });

    // Test: Source-over minimal test - classic blue square with red circle
    // Demonstrates source-over (default) draws source over destination

    registerVisualTest('source-over-minimal', {
        name: 'Source-over minimal - blue square then red circle with source-over',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Draw blue square as destination (55x55 at position 5,5)
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            
            // Apply source-over composite operation (default)
            ctx.globalCompositeOperation = 'source-over';
            
            // Draw red circle centered at (65,65) with radius 32
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            
            // Expected result:
            // - Red circle appears on top of blue square in overlap area
            // - Blue square remains blue where red doesn't overlap
            // - Red circle extends beyond the blue square
        }
    });

    // Test: Destination-over minimal test - classic blue square with red circle
    // Demonstrates destination-over draws source behind destination

    registerVisualTest('destination-over-minimal', {
        name: 'Destination-over minimal - blue square then red circle with destination-over',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Draw blue square as destination (55x55 at position 5,5)
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            
            // Apply destination-over composite operation
            ctx.globalCompositeOperation = 'destination-over';
            
            // Draw red circle centered at (65,65) with radius 32
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            
            // Expected result:
            // - Blue square remains on top in overlap area
            // - Red circle appears behind blue square where they overlap
            // - Red circle shows in areas where there's no blue square
        }
    });

    // Test: Destination-atop minimal test - classic blue square with red circle
    // Demonstrates destination-atop only shows destination where source exists

    registerVisualTest('destination-atop-minimal', {
        name: 'Destination-atop minimal - blue square then red circle with destination-atop',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Draw blue square as destination (55x55 at position 5,5)
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            
            // Apply destination-atop composite operation
            ctx.globalCompositeOperation = 'destination-atop';
            
            // Draw red circle centered at (65,65) with radius 32
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            
            // Expected result:
            // - Blue square appears only where red circle overlaps it
            // - Red circle appears in non-overlapping areas
            // - Blue square parts outside red circle disappear
        }
    });

    // Test: Source-in minimal test - classic blue square with red circle
    // Demonstrates source-in only shows source where destination exists

    registerVisualTest('source-in-minimal', {
        name: 'Source-in minimal - blue square then red circle with source-in',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Draw blue square as destination (55x55 at position 5,5)
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            
            // Apply source-in composite operation
            ctx.globalCompositeOperation = 'source-in';
            
            // Draw red circle centered at (65,65) with radius 32
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            
            // Expected result:
            // - Red circle appears only where it overlaps the blue square
            // - Blue square disappears entirely (replaced by red in overlap)
            // - Red circle parts outside blue square disappear
        }
    });

    // Test: Destination-in minimal test - classic blue square with red circle
    // Demonstrates destination-in only shows destination where source exists

    registerVisualTest('destination-in-minimal', {
        name: 'Destination-in minimal - blue square then red circle with destination-in',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Draw blue square as destination (55x55 at position 5,5)
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            
            // Apply destination-in composite operation
            ctx.globalCompositeOperation = 'destination-in';
            
            // Draw red circle centered at (65,65) with radius 32
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            
            // Expected result:
            // - Blue square appears only where red circle overlaps it
            // - Red circle disappears entirely (acts as mask for blue)
            // - Blue square parts outside red circle disappear
        }
    });

    // Test: Source-out minimal test - classic blue square with red circle
    // Demonstrates source-out shows source only where destination doesn't exist

    registerVisualTest('source-out-minimal', {
        name: 'Source-out minimal - blue square then red circle with source-out',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Draw blue square as destination (55x55 at position 5,5)
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            
            // Apply source-out composite operation
            ctx.globalCompositeOperation = 'source-out';
            
            // Draw red circle centered at (65,65) with radius 32
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            
            // Expected result:
            // - Red circle appears only where it doesn't overlap blue square
            // - Blue square disappears entirely
            // - Overlap area becomes transparent (red punches hole)
        }
    });

    // Test: Destination-out minimal test - classic blue square with red circle
    // Demonstrates destination-out shows destination only where source doesn't exist

    registerVisualTest('destination-out-minimal', {
        name: 'Destination-out minimal - blue square then red circle with destination-out',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Draw blue square as destination (55x55 at position 5,5)
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            
            // Apply destination-out composite operation
            ctx.globalCompositeOperation = 'destination-out';
            
            // Draw red circle centered at (65,65) with radius 32
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            
            // Expected result:
            // - Blue square appears only where red circle doesn't overlap it
            // - Red circle disappears entirely (acts as eraser)
            // - Overlap area becomes transparent (red cuts hole in blue)
        }
    });

    // Test: XOR minimal test - classic blue square with red circle
    // Demonstrates XOR creates "bite" effect where shapes overlap

    registerVisualTest('xor-minimal', {
        name: 'XOR minimal - blue square then red circle with xor',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Draw blue square as destination (55x55 at position 5,5)
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            
            // Apply xor composite operation
            ctx.globalCompositeOperation = 'xor';
            
            // Draw red circle centered at (65,65) with radius 32
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            
            // Expected result:
            // - Blue square appears where red circle doesn't overlap
            // - Red circle appears where blue square doesn't exist
            // - Overlap area becomes transparent ("bite" effect)
        }
    });

    // Test: Copy minimal test - classic blue square with red circle
    // Demonstrates copy replaces entire canvas with source

    registerVisualTest('copy-minimal', {
        name: 'Copy minimal - blue square then red circle with copy',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Draw blue square as destination (55x55 at position 5,5)
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            
            // Apply copy composite operation
            ctx.globalCompositeOperation = 'copy';
            
            // Draw red circle centered at (65,65) with radius 32
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            
            // Expected result:
            // - Only red circle appears
            // - Blue square disappears entirely (replaced by transparent)
            // - Canvas becomes transparent everywhere except red circle
        }
    });

    // Test: Source-atop clipped test - verifies composite operations work correctly with clipping
    // Tests interaction between clipping mask and composite operation masks

    registerVisualTest('source-atop-clipped', {
        name: 'Source-atop clipped - diagonal lines + rectangular clip + blue square + red circle with source-atop',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Step 1: Draw diagonal orange lines across entire canvas
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 100, 100);
            }
            ctx.stroke();
            
            // Step 2: Clip canvas to rectangular path inset by 10px
            ctx.beginPath();
            ctx.rect(10, 10, 80, 80);
            ctx.clip();
            
            // Step 3: Draw orthogonal black diagonal lines (only visible in clipped area)
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 100);
                ctx.lineTo(i + 100, 0);
            }
            ctx.stroke();
            
            // Step 4a: Draw blue square as destination (55x55 at position 5,5)
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            
            // Step 4b: Apply source-atop composite operation
            ctx.globalCompositeOperation = 'source-atop';
            
            // Step 4c: Draw red circle centered at (75,75) with radius 25
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            
            // Expected result:
            // - Orange diagonal lines visible outside 10px inset area
            // - Black diagonal lines crosshatch pattern visible inside 10px inset area
            // - Blue square and red circle composite only visible within clipped area
            // - Red appears only where it overlaps blue square (source-atop behavior)
            // - All composite operation effects confined to clipped region
        }
    });

    // Test: Source-over clipped test - verifies composite operations work correctly with clipping
    // Tests interaction between clipping mask and composite operation masks

    registerVisualTest('source-over-clipped', {
        name: 'Source-over clipped - diagonal lines + rectangular clip + blue square + red circle with source-over',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Step 1: Draw diagonal orange lines across entire canvas
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 100, 100);
            }
            ctx.stroke();
            
            // Step 2: Clip canvas to rectangular path inset by 10px
            ctx.beginPath();
            ctx.rect(10, 10, 80, 80);
            ctx.clip();
            
            // Step 3: Draw orthogonal black diagonal lines (only visible in clipped area)
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 100);
                ctx.lineTo(i + 100, 0);
            }
            ctx.stroke();
            
            // Step 4a: Draw blue square as destination (55x55 at position 5,5)
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            
            // Step 4b: Apply source-over composite operation
            ctx.globalCompositeOperation = 'source-over';
            
            // Step 4c: Draw red circle centered at (65,65) with radius 32
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            
            // Expected result:
            // - Orange diagonal lines visible outside 10px inset area
            // - Black diagonal lines crosshatch pattern visible inside 10px inset area
            // - Blue square and red circle composite only visible within clipped area
            // - Red circle appears on top of blue square (source-over behavior)
            // - All composite operation effects confined to clipped region
        }
    });

    // Test: Destination-over clipped test - verifies composite operations work correctly with clipping
    // Tests interaction between clipping mask and composite operation masks

    registerVisualTest('destination-over-clipped', {
        name: 'Destination-over clipped - diagonal lines + rectangular clip + blue square + red circle with destination-over',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Step 1: Draw diagonal orange lines across entire canvas
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 100, 100);
            }
            ctx.stroke();
            
            // Step 2: Clip canvas to rectangular path inset by 10px
            ctx.beginPath();
            ctx.rect(10, 10, 80, 80);
            ctx.clip();
            
            // Step 3: Draw orthogonal black diagonal lines (only visible in clipped area)
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 100);
                ctx.lineTo(i + 100, 0);
            }
            ctx.stroke();
            
            // Step 4a: Draw blue square as destination (55x55 at position 5,5)
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            
            // Step 4b: Apply destination-over composite operation
            ctx.globalCompositeOperation = 'destination-over';
            
            // Step 4c: Draw red circle centered at (65,65) with radius 32
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            
            // Expected result:
            // - Orange diagonal lines visible outside 10px inset area
            // - Black diagonal lines crosshatch pattern visible inside 10px inset area
            // - Blue square and red circle composite only visible within clipped area
            // - Blue square remains on top in overlap area (destination-over behavior)
            // - All composite operation effects confined to clipped region
        }
    });

    // Test: Destination-atop clipped test - verifies composite operations work correctly with clipping
    // Tests interaction between clipping mask and composite operation masks

    registerVisualTest('destination-atop-clipped', {
        name: 'Destination-atop clipped - diagonal lines + rectangular clip + blue square + red circle with destination-atop',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Step 1: Draw diagonal orange lines across entire canvas
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 100, 100);
            }
            ctx.stroke();
            
            // Step 2: Clip canvas to rectangular path inset by 10px
            ctx.beginPath();
            ctx.rect(10, 10, 80, 80);
            ctx.clip();
            
            // Step 3: Draw orthogonal black diagonal lines (only visible in clipped area)
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 100);
                ctx.lineTo(i + 100, 0);
            }
            ctx.stroke();
            
            // Step 4a: Draw blue square as destination (55x55 at position 5,5)
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            
            // Step 4b: Apply destination-atop composite operation
            ctx.globalCompositeOperation = 'destination-atop';
            
            // Step 4c: Draw red circle centered at (65,65) with radius 32
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            
            // Expected result:
            // - Orange diagonal lines visible outside 10px inset area
            // - Black diagonal lines crosshatch pattern visible inside 10px inset area
            // - Blue square and red circle composite only visible within clipped area
            // - Blue square appears only where red circle overlaps it (destination-atop behavior)
            // - All composite operation effects confined to clipped region
        }
    });

    // Test: Source-in clipped test - verifies composite operations work correctly with clipping
    // Tests interaction between clipping mask and composite operation masks

    registerVisualTest('source-in-clipped', {
        name: 'Source-in clipped - diagonal lines + rectangular clip + blue square + red circle with source-in',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Step 1: Draw diagonal orange lines across entire canvas
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 100, 100);
            }
            ctx.stroke();
            
            // Step 2: Clip canvas to rectangular path inset by 10px
            ctx.beginPath();
            ctx.rect(10, 10, 80, 80);
            ctx.clip();
            
            // Step 3: Draw orthogonal black diagonal lines (only visible in clipped area)
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 100);
                ctx.lineTo(i + 100, 0);
            }
            ctx.stroke();
            
            // Step 4a: Draw blue square as destination (55x55 at position 5,5)
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            
            // Step 4b: Apply source-in composite operation
            ctx.globalCompositeOperation = 'source-in';
            
            // Step 4c: Draw red circle centered at (65,65) with radius 32
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            
            // Expected result:
            // - Orange diagonal lines visible outside 10px inset area
            // - Black diagonal lines crosshatch pattern visible inside 10px inset area
            // - Blue square and red circle composite only visible within clipped area
            // - Red circle appears only where it overlaps blue square (source-in behavior)
            // - All composite operation effects confined to clipped region
        }
    });

    // Test: Destination-in clipped test - verifies composite operations work correctly with clipping
    // Tests interaction between clipping mask and composite operation masks

    registerVisualTest('destination-in-clipped', {
        name: 'Destination-in clipped - diagonal lines + rectangular clip + blue square + red circle with destination-in',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Step 1: Draw diagonal orange lines across entire canvas
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 100, 100);
            }
            ctx.stroke();
            
            // Step 2: Clip canvas to rectangular path inset by 10px
            ctx.beginPath();
            ctx.rect(10, 10, 80, 80);
            ctx.clip();
            
            // Step 3: Draw orthogonal black diagonal lines (only visible in clipped area)
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 100);
                ctx.lineTo(i + 100, 0);
            }
            ctx.stroke();
            
            // Step 4a: Draw blue square as destination (55x55 at position 5,5)
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            
            // Step 4b: Apply destination-in composite operation
            ctx.globalCompositeOperation = 'destination-in';
            
            // Step 4c: Draw red circle centered at (65,65) with radius 32
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            
            // Expected result:
            // - Orange diagonal lines visible outside 10px inset area
            // - Black diagonal lines crosshatch pattern visible inside 10px inset area
            // - Blue square and red circle composite only visible within clipped area
            // - Blue square appears only where red circle overlaps it (destination-in behavior)
            // - All composite operation effects confined to clipped region
        }
    });

    // Test: Source-out clipped test - verifies composite operations work correctly with clipping
    // Tests interaction between clipping mask and composite operation masks

    registerVisualTest('source-out-clipped', {
        name: 'Source-out clipped - diagonal lines + rectangular clip + blue square + red circle with source-out',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Step 1: Draw diagonal orange lines across entire canvas
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 100, 100);
            }
            ctx.stroke();
            
            // Step 2: Clip canvas to rectangular path inset by 10px
            ctx.beginPath();
            ctx.rect(10, 10, 80, 80);
            ctx.clip();
            
            // Step 3: Draw orthogonal black diagonal lines (only visible in clipped area)
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 100);
                ctx.lineTo(i + 100, 0);
            }
            ctx.stroke();
            
            // Step 4a: Draw blue square as destination (55x55 at position 5,5)
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            
            // Step 4b: Apply source-out composite operation
            ctx.globalCompositeOperation = 'source-out';
            
            // Step 4c: Draw red circle centered at (65,65) with radius 32
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            
            // Expected result:
            // - Orange diagonal lines visible outside 10px inset area
            // - Black diagonal lines crosshatch pattern visible inside 10px inset area
            // - Blue square and red circle composite only visible within clipped area
            // - Red circle appears only where it doesn't overlap blue square (source-out behavior)
            // - All composite operation effects confined to clipped region
        }
    });

    // Test: Destination-out clipped test - verifies composite operations work correctly with clipping
    // Tests interaction between clipping mask and composite operation masks

    registerVisualTest('destination-out-clipped', {
        name: 'Destination-out clipped - diagonal lines + rectangular clip + blue square + red circle with destination-out',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Step 1: Draw diagonal orange lines across entire canvas
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 100, 100);
            }
            ctx.stroke();
            
            // Step 2: Clip canvas to rectangular path inset by 10px
            ctx.beginPath();
            ctx.rect(10, 10, 80, 80);
            ctx.clip();
            
            // Step 3: Draw orthogonal black diagonal lines (only visible in clipped area)
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 100);
                ctx.lineTo(i + 100, 0);
            }
            ctx.stroke();
            
            // Step 4a: Draw blue square as destination (55x55 at position 5,5)
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            
            // Step 4b: Apply destination-out composite operation
            ctx.globalCompositeOperation = 'destination-out';
            
            // Step 4c: Draw red circle centered at (65,65) with radius 32
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            
            // Expected result:
            // - Orange diagonal lines visible outside 10px inset area
            // - Black diagonal lines crosshatch pattern visible inside 10px inset area
            // - Blue square and red circle composite only visible within clipped area
            // - Blue square appears only where red circle doesn't overlap it (destination-out behavior)
            // - All composite operation effects confined to clipped region
        }
    });

    // Test: XOR clipped test - verifies composite operations work correctly with clipping
    // Tests interaction between clipping mask and composite operation masks

    registerVisualTest('xor-clipped', {
        name: 'XOR clipped - diagonal lines + rectangular clip + blue square + red circle with xor',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Step 1: Draw diagonal orange lines across entire canvas
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 100, 100);
            }
            ctx.stroke();
            
            // Step 2: Clip canvas to rectangular path inset by 10px
            ctx.beginPath();
            ctx.rect(10, 10, 80, 80);
            ctx.clip();
            
            // Step 3: Draw orthogonal black diagonal lines (only visible in clipped area)
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 100);
                ctx.lineTo(i + 100, 0);
            }
            ctx.stroke();
            
            // Step 4a: Draw blue square as destination (55x55 at position 5,5)
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            
            // Step 4b: Apply xor composite operation
            ctx.globalCompositeOperation = 'xor';
            
            // Step 4c: Draw red circle centered at (65,65) with radius 32
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            
            // Expected result:
            // - Orange diagonal lines visible outside 10px inset area
            // - Black diagonal lines crosshatch pattern visible inside 10px inset area
            // - Blue square and red circle composite only visible within clipped area
            // - Overlap area becomes transparent "bite" effect (xor behavior)
            // - All composite operation effects confined to clipped region
        }
    });

    // Test: Copy clipped test - verifies composite operations work correctly with clipping
    // Tests interaction between clipping mask and composite operation masks

    registerVisualTest('copy-clipped', {
        name: 'Copy clipped - diagonal lines + rectangular clip + blue square + red circle with copy',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Step 1: Draw diagonal orange lines across entire canvas
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 100, 100);
            }
            ctx.stroke();
            
            // Step 2: Clip canvas to rectangular path inset by 10px
            ctx.beginPath();
            ctx.rect(10, 10, 80, 80);
            ctx.clip();
            
            // Step 3: Draw orthogonal black diagonal lines (only visible in clipped area)
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 100);
                ctx.lineTo(i + 100, 0);
            }
            ctx.stroke();
            
            // Step 4a: Draw blue square as destination (55x55 at position 5,5)
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            
            // Step 4b: Apply copy composite operation
            ctx.globalCompositeOperation = 'copy';
            
            // Step 4c: Draw red circle centered at (65,65) with radius 32
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            
            // Expected result:
            // - Orange diagonal lines visible outside 10px inset area
            // - Black diagonal lines crosshatch pattern visible inside 10px inset area
            // - Blue square and red circle composite only visible within clipped area
            // - Only red circle appears, everything else becomes transparent (copy behavior)
            // - All composite operation effects confined to clipped region
        }
    });

    // Test: Source-atop stroked test - classic blue square with red circle and green strokes
    // Demonstrates that source-atop only draws where destination exists, with green strokes

    registerVisualTest('source-atop-stroked', {
        name: 'Source-atop stroked - blue square + red circle with green strokes and source-atop',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Draw blue square as destination (55x55 at position 5,5) with 2px green stroke
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, 55, 55);
            
            // Apply source-atop composite operation
            ctx.globalCompositeOperation = 'source-atop';
            
            // Draw red circle centered at (65,65) with radius 32 with 2px green stroke
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Expected result:
            // - Red appears only where it overlaps the blue square (with green stroke)
            // - Green stroke on circle appears only where it overlaps destination
            // - Outside the blue square, red and its green stroke should not appear
            // - Blue square remains blue where red doesn't overlap, with green stroke visible
        }
    });

    // Test: Source-over stroked test - classic blue square with red circle and green strokes
    // Demonstrates source-over (default) draws source over destination, with green strokes

    registerVisualTest('source-over-stroked', {
        name: 'Source-over stroked - blue square + red circle with green strokes and source-over',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Draw blue square as destination (55x55 at position 5,5) with 2px green stroke
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, 55, 55);
            
            // Apply source-over composite operation (default)
            ctx.globalCompositeOperation = 'source-over';
            
            // Draw red circle centered at (65,65) with radius 32 with 2px green stroke
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Expected result:
            // - Red circle with green stroke appears on top of blue square in overlap area
            // - Blue square with green stroke remains visible where red doesn't overlap
            // - Red circle with green stroke extends beyond the blue square
        }
    });

    // Test: Destination-over stroked test - classic blue square with red circle and green strokes
    // Demonstrates destination-over draws source behind destination, with green strokes

    registerVisualTest('destination-over-stroked', {
        name: 'Destination-over stroked - blue square + red circle with green strokes and destination-over',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Draw blue square as destination (55x55 at position 5,5) with 2px green stroke
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, 55, 55);
            
            // Apply destination-over composite operation
            ctx.globalCompositeOperation = 'destination-over';
            
            // Draw red circle centered at (65,65) with radius 32 with 2px green stroke
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Expected result:
            // - Blue square with green stroke remains on top in overlap area
            // - Red circle with green stroke appears behind blue square where they overlap
            // - Red circle with green stroke shows in areas where there's no blue square
        }
    });

    // Test: Destination-atop stroked test - classic blue square with red circle and green strokes
    // Demonstrates destination-atop only shows destination where source exists, with green strokes

    registerVisualTest('destination-atop-stroked', {
        name: 'Destination-atop stroked - blue square + red circle with green strokes and destination-atop',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Draw blue square as destination (55x55 at position 5,5) with 2px green stroke
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, 55, 55);
            
            // Apply destination-atop composite operation
            ctx.globalCompositeOperation = 'destination-atop';
            
            // Draw red circle centered at (65,65) with radius 32 with 2px green stroke
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Expected result:
            // - Blue square with green stroke appears only where red circle overlaps
            // - Red circle with green stroke fills the rest of its area
            // - Blue square parts outside red circle disappear
        }
    });

    // Test: Source-in stroked test - classic blue square with red circle and green strokes
    // Demonstrates source-in only shows source where destination exists, with green strokes

    registerVisualTest('source-in-stroked', {
        name: 'Source-in stroked - blue square + red circle with green strokes and source-in',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Draw blue square as destination (55x55 at position 5,5) with 2px green stroke
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, 55, 55);
            
            // Apply source-in composite operation
            ctx.globalCompositeOperation = 'source-in';
            
            // Draw red circle centered at (65,65) with radius 32 with 2px green stroke
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Expected result:
            // - Red circle with green stroke appears only where it overlaps the blue square
            // - Blue square disappears entirely (replaced by red in overlap)
            // - Red circle parts outside blue square disappear, including green stroke
        }
    });

    // Test: Destination-in stroked test - classic blue square with red circle and green strokes
    // Demonstrates destination-in only shows destination where source exists, with green strokes

    registerVisualTest('destination-in-stroked', {
        name: 'Destination-in stroked - blue square + red circle with green strokes and destination-in',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Draw blue square as destination (55x55 at position 5,5) with 2px green stroke
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, 55, 55);
            
            // Apply destination-in composite operation
            ctx.globalCompositeOperation = 'destination-in';
            
            // Draw red circle centered at (65,65) with radius 32 with 2px green stroke
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Expected result:
            // - Blue square with green stroke appears only where red circle overlaps
            // - Red circle disappears entirely
            // - Blue square parts outside red circle disappear, including green stroke
        }
    });

    // Test: Source-out stroked test - classic blue square with red circle and green strokes
    // Demonstrates source-out shows source only where destination doesn't exist, with green strokes

    registerVisualTest('source-out-stroked', {
        name: 'Source-out stroked - blue square + red circle with green strokes and source-out',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Draw blue square as destination (55x55 at position 5,5) with 2px green stroke
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, 55, 55);
            
            // Apply source-out composite operation
            ctx.globalCompositeOperation = 'source-out';
            
            // Draw red circle centered at (65,65) with radius 32 with 2px green stroke
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Expected result:
            // - Red circle with green stroke appears only where it doesn't overlap blue square
            // - Blue square disappears entirely
            // - Red circle parts overlapping blue square disappear, including green stroke
        }
    });

    // Test: Destination-out stroked test - classic blue square with red circle and green strokes
    // Demonstrates destination-out removes destination where source exists, with green strokes

    registerVisualTest('destination-out-stroked', {
        name: 'Destination-out stroked - blue square + red circle with green strokes and destination-out',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Draw blue square as destination (55x55 at position 5,5) with 2px green stroke
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, 55, 55);
            
            // Apply destination-out composite operation
            ctx.globalCompositeOperation = 'destination-out';
            
            // Draw red circle centered at (65,65) with radius 32 with 2px green stroke
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Expected result:
            // - Blue square with green stroke appears only where red circle doesn't overlap
            // - Red circle disappears entirely (acts as eraser)
            // - Blue square parts overlapping red circle disappear, creating "hole"
        }
    });

    // Test: XOR stroked test - classic blue square with red circle and green strokes
    // Demonstrates XOR creates "bite" effect where shapes overlap, with green strokes

    registerVisualTest('xor-stroked', {
        name: 'XOR stroked - blue square + red circle with green strokes and xor',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Draw blue square as destination (55x55 at position 5,5) with 2px green stroke
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, 55, 55);
            
            // Apply xor composite operation
            ctx.globalCompositeOperation = 'xor';
            
            // Draw red circle centered at (65,65) with radius 32 with 2px green stroke
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Expected result:
            // - Blue square with green stroke appears where red circle doesn't overlap
            // - Red circle with green stroke appears where blue square doesn't exist
            // - Overlap area becomes transparent ("bite" effect), removing both shapes
        }
    });

    // Test: Copy stroked test - classic blue square with red circle and green strokes
    // Demonstrates copy replaces entire canvas with source, with green strokes

    registerVisualTest('copy-stroked', {
        name: 'Copy stroked - blue square + red circle with green strokes and copy',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Draw blue square as destination (55x55 at position 5,5) with 2px green stroke
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, 55, 55);
            
            // Apply copy composite operation
            ctx.globalCompositeOperation = 'copy';
            
            // Draw red circle centered at (65,65) with radius 32 with 2px green stroke
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Expected result:
            // - Only red circle with green stroke appears
            // - Blue square with green stroke disappears entirely (replaced by transparent)
            // - Canvas becomes transparent everywhere except red circle with green stroke
        }
    });

    // Test: Source-atop clipped stroked test - composite operations with clipping and strokes
    // Tests interaction between clipping mask, composite operation masks, and stroked shapes

    registerVisualTest('source-atop-clipped-stroked', {
        name: 'Source-atop clipped stroked - diagonal lines + rectangular clip + blue square + red circle with green strokes and source-atop',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Step 1: Draw diagonal orange lines across entire canvas
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 100, 100);
            }
            ctx.stroke();
            
            // Step 2: Clip canvas to rectangular path inset by 10px
            ctx.beginPath();
            ctx.rect(10, 10, 80, 80);
            ctx.clip();
            
            // Step 3: Draw orthogonal black diagonal lines (only visible in clipped area)
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 100);
                ctx.lineTo(i + 100, 0);
            }
            ctx.stroke();
            
            // Step 4: Draw blue square as destination (55x55 at position 5,5) with 2px green stroke
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, 55, 55);
            
            // Step 5: Apply source-atop composite operation
            ctx.globalCompositeOperation = 'source-atop';
            
            // Step 6: Draw red circle centered at (65,65) with radius 32 with 2px green stroke
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Expected result:
            // - Orange diagonal lines visible outside 10px inset area
            // - Black diagonal lines crosshatch pattern visible inside 10px inset area
            // - Blue square with green stroke as destination
            // - Red circle appears only where it overlaps blue square (source-atop behavior)
            // - Green stroke on circle appears only where it overlaps destination
            // - All composite operation effects confined to clipped region
        }
    });

    // Test: Source-over clipped stroked test - composite operations with clipping and strokes
    // Tests interaction between clipping mask, composite operation masks, and stroked shapes

    registerVisualTest('source-over-clipped-stroked', {
        name: 'Source-over clipped stroked - diagonal lines + rectangular clip + blue square + red circle with green strokes and source-over',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Step 1: Draw diagonal orange lines across entire canvas
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 100, 100);
            }
            ctx.stroke();
            
            // Step 2: Clip canvas to rectangular path inset by 10px
            ctx.beginPath();
            ctx.rect(10, 10, 80, 80);
            ctx.clip();
            
            // Step 3: Draw orthogonal black diagonal lines (only visible in clipped area)
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 100);
                ctx.lineTo(i + 100, 0);
            }
            ctx.stroke();
            
            // Step 4: Draw blue square as destination (55x55 at position 5,5) with 2px green stroke
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, 55, 55);
            
            // Step 5: Apply source-over composite operation
            ctx.globalCompositeOperation = 'source-over';
            
            // Step 6: Draw red circle centered at (65,65) with radius 32 with 2px green stroke
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Expected result:
            // - Orange diagonal lines visible outside 10px inset area
            // - Black diagonal lines crosshatch pattern visible inside 10px inset area
            // - Blue square with green stroke as destination
            // - Red circle with green stroke drawn over blue square (source-over behavior)
            // - Red circle and stroke fully visible where they overlap destination
            // - All composite operation effects confined to clipped region
        }
    });

    // Test: Destination-over clipped stroked test - composite operations with clipping and strokes
    // Tests interaction between clipping mask, composite operation masks, and stroked shapes

    registerVisualTest('destination-over-clipped-stroked', {
        name: 'Destination-over clipped stroked - diagonal lines + rectangular clip + blue square + red circle with green strokes and destination-over',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Step 1: Draw diagonal orange lines across entire canvas
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 100, 100);
            }
            ctx.stroke();
            
            // Step 2: Clip canvas to rectangular path inset by 10px
            ctx.beginPath();
            ctx.rect(10, 10, 80, 80);
            ctx.clip();
            
            // Step 3: Draw orthogonal black diagonal lines (only visible in clipped area)
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 100);
                ctx.lineTo(i + 100, 0);
            }
            ctx.stroke();
            
            // Step 4: Draw blue square as destination (55x55 at position 5,5) with 2px green stroke
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, 55, 55);
            
            // Step 5: Apply destination-over composite operation
            ctx.globalCompositeOperation = 'destination-over';
            
            // Step 6: Draw red circle centered at (65,65) with radius 32 with 2px green stroke
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Expected result:
            // - Orange diagonal lines visible outside 10px inset area
            // - Black diagonal lines crosshatch pattern visible inside 10px inset area
            // - Blue square with green stroke remains on top (destination-over behavior)
            // - Red circle with green stroke appears behind blue square
            // - Red circle visible where it doesn't overlap the blue square
            // - All composite operation effects confined to clipped region
        }
    });

    // Test: Destination-atop clipped stroked test - composite operations with clipping and strokes
    // Tests interaction between clipping mask, composite operation masks, and stroked shapes

    registerVisualTest('destination-atop-clipped-stroked', {
        name: 'Destination-atop clipped stroked - diagonal lines + rectangular clip + blue square + red circle with green strokes and destination-atop',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Step 1: Draw diagonal orange lines across entire canvas
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 100, 100);
            }
            ctx.stroke();
            
            // Step 2: Clip canvas to rectangular path inset by 10px
            ctx.beginPath();
            ctx.rect(10, 10, 80, 80);
            ctx.clip();
            
            // Step 3: Draw orthogonal black diagonal lines (only visible in clipped area)
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 100);
                ctx.lineTo(i + 100, 0);
            }
            ctx.stroke();
            
            // Step 4: Draw blue square as destination (55x55 at position 5,5) with 2px green stroke
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, 55, 55);
            
            // Step 5: Apply destination-atop composite operation
            ctx.globalCompositeOperation = 'destination-atop';
            
            // Step 6: Draw red circle centered at (65,65) with radius 32 with 2px green stroke
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Expected result:
            // - Orange diagonal lines visible outside 10px inset area
            // - Black diagonal lines crosshatch pattern visible inside 10px inset area
            // - Blue square appears only where it overlaps red circle (destination-atop behavior)
            // - Green stroke on square appears only where it overlaps the red circle
            // - Red circle with green stroke fully visible as the source
            // - All composite operation effects confined to clipped region
        }
    });

    // Test: Source-in clipped stroked test - composite operations with clipping and strokes
    // Tests interaction between clipping mask, composite operation masks, and stroked shapes

    registerVisualTest('source-in-clipped-stroked', {
        name: 'Source-in clipped stroked - diagonal lines + rectangular clip + blue square + red circle with green strokes and source-in',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Step 1: Draw diagonal orange lines across entire canvas
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 100, 100);
            }
            ctx.stroke();
            
            // Step 2: Clip canvas to rectangular path inset by 10px
            ctx.beginPath();
            ctx.rect(10, 10, 80, 80);
            ctx.clip();
            
            // Step 3: Draw orthogonal black diagonal lines (only visible in clipped area)
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 100);
                ctx.lineTo(i + 100, 0);
            }
            ctx.stroke();
            
            // Step 4: Draw blue square as destination (55x55 at position 5,5) with 2px green stroke
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, 55, 55);
            
            // Step 5: Apply source-in composite operation
            ctx.globalCompositeOperation = 'source-in';
            
            // Step 6: Draw red circle centered at (65,65) with radius 32 with 2px green stroke
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Expected result:
            // - Orange diagonal lines visible outside 10px inset area
            // - Black diagonal lines crosshatch pattern visible inside 10px inset area
            // - Red circle appears only where it overlaps blue square (source-in behavior)
            // - Green stroke on circle appears only where it overlaps blue square
            // - Blue square is completely replaced where red circle overlaps
            // - All composite operation effects confined to clipped region
        }
    });

    // Test: Destination-in clipped stroked test - composite operations with clipping and strokes
    // Tests interaction between clipping mask, composite operation masks, and stroked shapes

    registerVisualTest('destination-in-clipped-stroked', {
        name: 'Destination-in clipped stroked - diagonal lines + rectangular clip + blue square + red circle with green strokes and destination-in',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Step 1: Draw diagonal orange lines across entire canvas
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 100, 100);
            }
            ctx.stroke();
            
            // Step 2: Clip canvas to rectangular path inset by 10px
            ctx.beginPath();
            ctx.rect(10, 10, 80, 80);
            ctx.clip();
            
            // Step 3: Draw orthogonal black diagonal lines (only visible in clipped area)
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 100);
                ctx.lineTo(i + 100, 0);
            }
            ctx.stroke();
            
            // Step 4: Draw blue square as destination (55x55 at position 5,5) with 2px green stroke
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, 55, 55);
            
            // Step 5: Apply destination-in composite operation
            ctx.globalCompositeOperation = 'destination-in';
            
            // Step 6: Draw red circle centered at (65,65) with radius 32 with 2px green stroke
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Expected result:
            // - Orange diagonal lines visible outside 10px inset area
            // - Black diagonal lines crosshatch pattern visible inside 10px inset area
            // - Blue square appears only where it overlaps red circle (destination-in behavior)
            // - Green stroke on square appears only where it overlaps red circle
            // - Red circle is not visible (destination-in only keeps destination inside source)
            // - All composite operation effects confined to clipped region
        }
    });

    // Test: Source-out clipped stroked test - composite operations with clipping and strokes
    // Tests interaction between clipping mask, composite operation masks, and stroked shapes

    registerVisualTest('source-out-clipped-stroked', {
        name: 'Source-out clipped stroked - diagonal lines + rectangular clip + blue square + red circle with green strokes and source-out',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Step 1: Draw diagonal orange lines across entire canvas
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 100, 100);
            }
            ctx.stroke();
            
            // Step 2: Clip canvas to rectangular path inset by 10px
            ctx.beginPath();
            ctx.rect(10, 10, 80, 80);
            ctx.clip();
            
            // Step 3: Draw orthogonal black diagonal lines (only visible in clipped area)
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 100);
                ctx.lineTo(i + 100, 0);
            }
            ctx.stroke();
            
            // Step 4: Draw blue square as destination (55x55 at position 5,5) with 2px green stroke
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, 55, 55);
            
            // Step 5: Apply source-out composite operation
            ctx.globalCompositeOperation = 'source-out';
            
            // Step 6: Draw red circle centered at (65,65) with radius 32 with 2px green stroke
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Expected result:
            // - Orange diagonal lines visible outside 10px inset area
            // - Black diagonal lines crosshatch pattern visible inside 10px inset area
            // - Red circle appears only where it doesn't overlap blue square (source-out behavior)
            // - Green stroke on circle appears only where it doesn't overlap blue square
            // - Blue square with green stroke remains unchanged
            // - All composite operation effects confined to clipped region
        }
    });

    // Test: Destination-out clipped stroked test - composite operations with clipping and strokes
    // Tests interaction between clipping mask, composite operation masks, and stroked shapes

    registerVisualTest('destination-out-clipped-stroked', {
        name: 'Destination-out clipped stroked - diagonal lines + rectangular clip + blue square + red circle with green strokes and destination-out',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Step 1: Draw diagonal orange lines across entire canvas
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 100, 100);
            }
            ctx.stroke();
            
            // Step 2: Clip canvas to rectangular path inset by 10px
            ctx.beginPath();
            ctx.rect(10, 10, 80, 80);
            ctx.clip();
            
            // Step 3: Draw orthogonal black diagonal lines (only visible in clipped area)
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 100);
                ctx.lineTo(i + 100, 0);
            }
            ctx.stroke();
            
            // Step 4: Draw blue square as destination (55x55 at position 5,5) with 2px green stroke
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, 55, 55);
            
            // Step 5: Apply destination-out composite operation
            ctx.globalCompositeOperation = 'destination-out';
            
            // Step 6: Draw red circle centered at (65,65) with radius 32 with 2px green stroke
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Expected result:
            // - Orange diagonal lines visible outside 10px inset area
            // - Black diagonal lines crosshatch pattern visible inside 10px inset area
            // - Blue square appears only where it doesn't overlap red circle (destination-out behavior)
            // - Green stroke on square appears only where it doesn't overlap red circle
            // - Red circle is not visible (destination-out removes destination inside source)
            // - All composite operation effects confined to clipped region
        }
    });

    // Test: XOR clipped stroked test - composite operations with clipping and strokes
    // Tests interaction between clipping mask, composite operation masks, and stroked shapes

    registerVisualTest('xor-clipped-stroked', {
        name: 'XOR clipped stroked - diagonal lines + rectangular clip + blue square + red circle with green strokes and xor',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Step 1: Draw diagonal orange lines across entire canvas
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 100, 100);
            }
            ctx.stroke();
            
            // Step 2: Clip canvas to rectangular path inset by 10px
            ctx.beginPath();
            ctx.rect(10, 10, 80, 80);
            ctx.clip();
            
            // Step 3: Draw orthogonal black diagonal lines (only visible in clipped area)
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 100);
                ctx.lineTo(i + 100, 0);
            }
            ctx.stroke();
            
            // Step 4: Draw blue square as destination (55x55 at position 5,5) with 2px green stroke
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, 55, 55);
            
            // Step 5: Apply xor composite operation
            ctx.globalCompositeOperation = 'xor';
            
            // Step 6: Draw red circle centered at (65,65) with radius 32 with 2px green stroke
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Expected result:
            // - Orange diagonal lines visible outside 10px inset area
            // - Black diagonal lines crosshatch pattern visible inside 10px inset area
            // - Blue square visible where it doesn't overlap red circle (xor behavior)
            // - Red circle visible where it doesn't overlap blue square (xor behavior)
            // - Green strokes visible only where they don't overlap the other shape
            // - Overlapping areas of both shapes are transparent (xor removes overlaps)
            // - All composite operation effects confined to clipped region
        }
    });

    // Test: Copy clipped stroked test - composite operations with clipping and strokes
    // Tests interaction between clipping mask, composite operation masks, and stroked shapes

    registerVisualTest('copy-clipped-stroked', {
        name: 'Copy clipped stroked - diagonal lines + rectangular clip + blue square + red circle with green strokes and copy',
        width: 100, height: 100,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // Step 1: Draw diagonal orange lines across entire canvas
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 100, 100);
            }
            ctx.stroke();
            
            // Step 2: Clip canvas to rectangular path inset by 10px
            ctx.beginPath();
            ctx.rect(10, 10, 80, 80);
            ctx.clip();
            
            // Step 3: Draw orthogonal black diagonal lines (only visible in clipped area)
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = -100; i <= 200; i += 10) {
                ctx.moveTo(i, 100);
                ctx.lineTo(i + 100, 0);
            }
            ctx.stroke();
            
            // Step 4: Draw blue square as destination (55x55 at position 5,5) with 2px green stroke
            ctx.fillStyle = 'blue';
            ctx.fillRect(5, 5, 55, 55);
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, 55, 55);
            
            // Step 5: Apply copy composite operation
            ctx.globalCompositeOperation = 'copy';
            
            // Step 6: Draw red circle centered at (65,65) with radius 32 with 2px green stroke
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(65, 65, 32, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Expected result:
            // - Orange diagonal lines visible outside 10px inset area
            // - Black diagonal lines crosshatch pattern may be partially visible
            // - Red circle with green stroke completely replaces all content (copy behavior)
            // - Blue square is not visible where red circle is drawn
            // - Background diagonal lines are cleared where red circle is drawn
            // - Only the red circle with green stroke visible in its area
            // - All composite operation effects confined to clipped region
        }
    });

    // Test: ellipse-basic - Basic ellipse functionality
    // This file will be concatenated into the main visual test suite

    registerVisualTest('ellipse-basic', {
        name: 'Basic ellipse functionality',
        width: 400, height: 300,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 400, 300);
            
            // Full ellipse (horizontal)
            ctx.beginPath();
            ctx.fillStyle = 'red';
            ctx.ellipse(100, 75, 60, 30, 0, 0, 2 * Math.PI);
            ctx.fill();
            
            // Full ellipse (vertical)
            ctx.beginPath();
            ctx.fillStyle = 'green';
            ctx.ellipse(300, 75, 30, 60, 0, 0, 2 * Math.PI);
            ctx.fill();
            
            // Rotated ellipse (45 degrees)
            ctx.beginPath();
            ctx.fillStyle = 'blue';
            ctx.ellipse(100, 180, 50, 25, Math.PI / 4, 0, 2 * Math.PI);
            ctx.fill();
            
            // Half ellipse (semicircle-like)
            ctx.beginPath();
            ctx.fillStyle = 'orange';
            ctx.ellipse(300, 180, 40, 20, 0, 0, Math.PI);
            ctx.fill();
            
            // Ellipse arc (quarter ellipse)
            ctx.beginPath();
            ctx.strokeStyle = 'purple';
            ctx.lineWidth = 3;
            ctx.ellipse(200, 150, 30, 50, Math.PI / 6, 0, Math.PI / 2);
            ctx.stroke();
            
            // Circle using ellipse (equal radii)
            ctx.beginPath();
            ctx.fillStyle = 'cyan';
            ctx.ellipse(200, 240, 25, 25, 0, 0, 2 * Math.PI);
            ctx.fill();
        },
    });

    // Test: arcTo basic functionality
    // This file will be concatenated into the main visual test suite

    registerVisualTest('arcto-basic', {
        name: 'arcTo basic rounded corners',
        width: 400, height: 300,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 400, 300);
            
            // Test 1: Basic rounded rectangle using arcTo
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(50, 80);
            ctx.lineTo(120, 80);       // Top edge
            ctx.arcTo(150, 80, 150, 110, 20);  // Top-right corner
            ctx.lineTo(150, 140);      // Right edge  
            ctx.arcTo(150, 170, 120, 170, 20); // Bottom-right corner
            ctx.lineTo(50, 170);       // Bottom edge
            ctx.arcTo(20, 170, 20, 140, 20);   // Bottom-left corner
            ctx.lineTo(20, 110);       // Left edge
            ctx.arcTo(20, 80, 50, 80, 20);     // Top-left corner
            ctx.closePath();
            ctx.stroke();
            
            // Test 2: Different radius sizes
            ctx.strokeStyle = 'blue';
            ctx.beginPath();
            ctx.moveTo(200, 50);
            ctx.lineTo(270, 50);
            ctx.arcTo(300, 50, 300, 80, 5);   // Small radius
            ctx.lineTo(300, 120);
            ctx.arcTo(300, 150, 270, 150, 40); // Large radius
            ctx.lineTo(200, 150);
            ctx.arcTo(170, 150, 170, 120, 15); // Medium radius
            ctx.lineTo(170, 80);
            ctx.arcTo(170, 50, 200, 50, 25);   // Medium radius
            ctx.closePath();
            ctx.stroke();
            
            // Test 3: arcTo with fill
            ctx.fillStyle = 'lightgreen';
            ctx.strokeStyle = 'darkgreen';
            ctx.beginPath();
            ctx.moveTo(50, 200);
            ctx.lineTo(100, 200);
            ctx.arcTo(130, 200, 130, 230, 15);
            ctx.lineTo(130, 250);
            ctx.arcTo(130, 280, 100, 280, 15);
            ctx.lineTo(50, 280);
            ctx.arcTo(20, 280, 20, 250, 15);
            ctx.lineTo(20, 230);
            ctx.arcTo(20, 200, 50, 200, 15);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            // Test 4: Sharp angles
            ctx.strokeStyle = 'purple';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(250, 200);
            ctx.lineTo(320, 220);
            ctx.arcTo(350, 230, 340, 260, 10); // Sharp angle
            ctx.lineTo(300, 280);
            ctx.arcTo(280, 290, 250, 270, 15);
            ctx.lineTo(230, 240);
            ctx.arcTo(225, 210, 250, 200, 12);
            ctx.stroke();
        }
    });

    // Test: arcTo edge cases
    // This file will be concatenated into the main visual test suite

    registerVisualTest('arcto-edge-cases', {
        name: 'arcTo edge cases - zero radius and collinear points',
        width: 400, height: 300,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 400, 300);
            
            // Test 1: Zero radius (should create sharp corners)
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(50, 50);
            ctx.lineTo(120, 50);
            ctx.arcTo(150, 50, 150, 80, 0);  // Zero radius
            ctx.lineTo(150, 120);
            ctx.arcTo(150, 150, 120, 150, 0); // Zero radius
            ctx.lineTo(50, 150);
            ctx.arcTo(20, 150, 20, 120, 0);   // Zero radius
            ctx.lineTo(20, 80);
            ctx.arcTo(20, 50, 50, 50, 0);     // Zero radius
            ctx.closePath();
            ctx.stroke();
            
            // Test 2: Collinear points (horizontal line)
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(200, 80);
            ctx.arcTo(250, 80, 300, 80, 20); // All points on horizontal line
            ctx.lineTo(350, 80);
            ctx.stroke();
            
            // Test 3: Collinear points (vertical line)
            ctx.strokeStyle = 'green';
            ctx.beginPath();
            ctx.moveTo(220, 100);
            ctx.arcTo(220, 130, 220, 160, 15); // All points on vertical line
            ctx.lineTo(220, 190);
            ctx.stroke();
            
            // Test 4: Very small angles (should still work)
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(50, 200);
            ctx.lineTo(100, 205);  // Very small angle
            ctx.arcTo(150, 210, 200, 215, 10);
            ctx.lineTo(250, 220);
            ctx.stroke();
            
            // Test 5: Very large radius (should be clamped)
            ctx.strokeStyle = 'purple';
            ctx.beginPath();
            ctx.moveTo(100, 250);
            ctx.lineTo(150, 250);
            ctx.arcTo(200, 250, 200, 280, 100); // Radius larger than available space
            ctx.lineTo(200, 290);
            ctx.stroke();
            
            // Test 6: Acute angle
            ctx.strokeStyle = 'brown';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(300, 200);
            ctx.lineTo(340, 220);
            ctx.arcTo(360, 230, 350, 260, 8); // Sharp acute angle
            ctx.lineTo(330, 280);
            ctx.stroke();
        }
    });

    // Test: isPointInPath basic functionality
    // This file will be concatenated into the main visual test suite

    registerVisualTest('ispointinpath-basic', {
        name: 'isPointInPath basic point testing with visual indicators',
        width: 400, height: 300,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 400, 300);
            
            // Create test shapes
            // Shape 1: Rectangle
            ctx.fillStyle = 'lightblue';
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.rect(50, 50, 100, 80);
            ctx.fill();
            ctx.stroke();
            
            // Shape 2: Circle
            ctx.fillStyle = 'lightgreen';
            ctx.strokeStyle = 'darkgreen';
            ctx.beginPath();
            ctx.arc(250, 90, 40, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Shape 3: Complex path with curves
            ctx.fillStyle = 'lightcoral';
            ctx.strokeStyle = 'darkred';
            ctx.beginPath();
            ctx.moveTo(50, 180);
            ctx.lineTo(120, 160);
            ctx.quadraticCurveTo(150, 180, 120, 220);
            ctx.lineTo(80, 240);
            ctx.bezierCurveTo(60, 250, 40, 230, 50, 200);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            // Shape 4: Triangle
            ctx.fillStyle = 'lightyellow';
            ctx.strokeStyle = 'orange';
            ctx.beginPath();
            ctx.moveTo(250, 180);
            ctx.lineTo(320, 220);
            ctx.lineTo(280, 260);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            // Test points and draw indicators - comprehensive coverage showing both inside and outside points
            const testPoints = [
                // Rectangle tests (rect: 50,50,100,80 -> bounds x:50-150, y:50-130)
                // Edge points (all edges inclusive)
                {x: 50, y: 60, shape: 'rect', expected: true},     // Left edge (top)
                {x: 50, y: 90, shape: 'rect', expected: true},     // Left edge (middle)
                {x: 50, y: 120, shape: 'rect', expected: true},    // Left edge (bottom)
                {x: 150, y: 60, shape: 'rect', expected: true},    // Right edge (top)
                {x: 150, y: 90, shape: 'rect', expected: true},    // Right edge (middle)
                {x: 150, y: 120, shape: 'rect', expected: true},   // Right edge (bottom)
                {x: 70, y: 50, shape: 'rect', expected: true},     // Top edge (left)
                {x: 100, y: 50, shape: 'rect', expected: true},    // Top edge (center)
                {x: 130, y: 50, shape: 'rect', expected: true},    // Top edge (right)
                {x: 70, y: 130, shape: 'rect', expected: true},    // Bottom edge (left)
                {x: 100, y: 130, shape: 'rect', expected: true},   // Bottom edge (center)
                {x: 130, y: 130, shape: 'rect', expected: true},   // Bottom edge (right)
                // Interior points
                {x: 100, y: 90, shape: 'rect', expected: true},    // Center
                {x: 75, y: 70, shape: 'rect', expected: true},     // Upper-left interior
                {x: 125, y: 110, shape: 'rect', expected: true},   // Lower-right interior
                // Outside points
                {x: 30, y: 90, shape: 'rect', expected: false},    // Outside left
                {x: 170, y: 90, shape: 'rect', expected: false},   // Outside right
                {x: 100, y: 30, shape: 'rect', expected: false},   // Outside top
                {x: 100, y: 150, shape: 'rect', expected: false},  // Outside bottom
                
                // Circle tests (center: 250,90, radius: 40)
                // Center and interior
                {x: 250, y: 90, shape: 'circle', expected: true},  // Center
                {x: 240, y: 90, shape: 'circle', expected: true},  // Inside (left)
                {x: 260, y: 90, shape: 'circle', expected: true},  // Inside (right)
                {x: 250, y: 80, shape: 'circle', expected: true},  // Inside (top)
                {x: 250, y: 100, shape: 'circle', expected: true}, // Inside (bottom)
                {x: 235, y: 75, shape: 'circle', expected: true},  // Inside (upper-left)
                {x: 265, y: 105, shape: 'circle', expected: true}, // Inside (lower-right)
                // Near edge points (just inside circle edge)
                {x: 215, y: 90, shape: 'circle', expected: true},  // Near left edge
                {x: 285, y: 90, shape: 'circle', expected: true},  // Near right edge
                {x: 250, y: 55, shape: 'circle', expected: true},  // Near top edge
                {x: 250, y: 125, shape: 'circle', expected: true}, // Near bottom edge
                // Outside points
                {x: 200, y: 90, shape: 'circle', expected: false}, // Outside left
                {x: 300, y: 90, shape: 'circle', expected: false}, // Outside right
                {x: 250, y: 40, shape: 'circle', expected: false}, // Outside top
                {x: 250, y: 140, shape: 'circle', expected: false}, // Outside bottom
                
                // Complex path tests - irregular shape with curves
                // Interior points in different regions
                {x: 70, y: 190, shape: 'complex', expected: true}, // Left region
                {x: 85, y: 200, shape: 'complex', expected: true}, // Central region
                {x: 100, y: 185, shape: 'complex', expected: true}, // Upper region
                {x: 90, y: 215, shape: 'complex', expected: true}, // Lower region
                {x: 110, y: 200, shape: 'complex', expected: true}, // Right region
                // Edge points
                {x: 50, y: 190, shape: 'complex', expected: true}, // Left edge (approximate)
                {x: 120, y: 170, shape: 'complex', expected: true}, // Top edge (approximate)
                // Outside points
                {x: 30, y: 200, shape: 'complex', expected: false}, // Outside left
                {x: 140, y: 190, shape: 'complex', expected: false}, // Outside right
                {x: 85, y: 150, shape: 'complex', expected: false}, // Outside top
                {x: 85, y: 260, shape: 'complex', expected: false}, // Outside bottom
                
                // Triangle tests (vertices: 250,180 -> 320,220 -> 280,260)
                // Interior points
                {x: 280, y: 200, shape: 'triangle', expected: true}, // Upper interior
                {x: 285, y: 220, shape: 'triangle', expected: true}, // Central interior
                {x: 290, y: 240, shape: 'triangle', expected: true}, // Lower interior
                {x: 270, y: 210, shape: 'triangle', expected: true}, // Left interior
                {x: 300, y: 230, shape: 'triangle', expected: true}, // Right interior
                // Edge points (approximate)
                {x: 285, y: 190, shape: 'triangle', expected: true}, // Top edge
                {x: 265, y: 220, shape: 'triangle', expected: true}, // Left edge
                {x: 300, y: 240, shape: 'triangle', expected: true}, // Right edge
                // Outside points
                {x: 240, y: 200, shape: 'triangle', expected: false}, // Outside left
                {x: 330, y: 220, shape: 'triangle', expected: false}, // Outside right
                {x: 280, y: 170, shape: 'triangle', expected: false}, // Outside top
                {x: 280, y: 270, shape: 'triangle', expected: false}, // Outside bottom
            ];
            
            // Test points using current path (since we can't rely on Path2D constructor in all browsers)
            // We'll test by setting the current path and using isPointInPath(x, y)
            
            // Test each point and collect results first (separate testing from drawing)
            const results = testPoints.map(point => {
                // Set up current path based on shape for testing
                ctx.beginPath();
                switch(point.shape) {
                    case 'rect': 
                        ctx.rect(50, 50, 100, 80);
                        break;
                    case 'circle':
                        ctx.arc(250, 90, 40, 0, Math.PI * 2);
                        break;
                    case 'complex':
                        ctx.moveTo(50, 180);
                        ctx.lineTo(120, 160);
                        ctx.quadraticCurveTo(150, 180, 120, 220);
                        ctx.lineTo(80, 240);
                        ctx.bezierCurveTo(60, 250, 40, 230, 50, 200);
                        ctx.closePath();
                        break;
                    case 'triangle':
                        ctx.moveTo(250, 180);
                        ctx.lineTo(320, 220);
                        ctx.lineTo(280, 260);
                        ctx.closePath();
                        break;
                }
                
                const isInside = ctx.isPointInPath(point.x, point.y);
                const isCorrect = isInside === point.expected;
                
                return {
                    x: point.x,
                    y: point.y,
                    isCorrect: isCorrect,
                    expected: point.expected,
                    actual: isInside
                };
            });
            
            // Now draw all the indicators without interfering with paths
            // Color encoding: GREEN = inside path (true), RED = outside path (false)
            results.forEach(result => {
                // Draw point indicator circle
                ctx.beginPath();
                ctx.arc(result.x, result.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = result.actual ? 'green' : 'red'; // Green = inside, Red = outside
                ctx.fill();
                
                // Draw black border for visibility
                ctx.beginPath();
                ctx.arc(result.x, result.y, 4, 0, Math.PI * 2);
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 1;
                ctx.stroke();
                
                // Draw small cross for additional indicator
                ctx.beginPath();
                ctx.moveTo(result.x - 2, result.y);
                ctx.lineTo(result.x + 2, result.y);
                ctx.moveTo(result.x, result.y - 2);
                ctx.lineTo(result.x, result.y + 2);
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 1;
                ctx.stroke();
            });
            
            // Add legend showing color encoding
            ctx.fillStyle = 'green';
            ctx.beginPath();
            ctx.arc(330, 65, 6, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(330, 85, 6, 0, Math.PI * 2);
            ctx.fill();
            
            // Legend: Green circle = inside path, Red circle = outside path
        }
    });

    // Test: isPointInPath fill rule comparison
    // This file will be concatenated into the main visual test suite

    registerVisualTest('ispointinpath-fillrule', {
        name: 'isPointInPath evenodd vs nonzero fill rules',
        width: 500, height: 180,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 500, 180);
            
            // Create current path with hole (outer rectangle + inner rectangle)  
            ctx.beginPath();
            // Outer rectangle
            ctx.rect(50, 50, 150, 100);
            // Inner rectangle (hole) - same winding direction
            ctx.rect(75, 75, 100, 50);
            
            // Draw the shapes for reference
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Fill the path with nonzero rule first (left side)
            ctx.fillStyle = 'rgba(200, 200, 255, 0.3)';
            ctx.fill('nonzero');
            
            // Create offset path for evenodd visualization (right side)
            ctx.beginPath();
            ctx.rect(280, 50, 150, 100);
            ctx.rect(305, 75, 100, 50);
            
            // Draw the offset shapes for reference
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Fill with evenodd to show hole
            ctx.fillStyle = 'rgba(255, 200, 200, 0.3)';
            ctx.fill('evenodd');
            
            // Test points in different regions
            const testPoints = [
                // Points in outer area (between outer and inner rectangles)
                {x: 60, y: 80, label: 'Outer area'},
                {x: 180, y: 100, label: 'Outer area'}, 
                {x: 100, y: 60, label: 'Outer area'},
                {x: 150, y: 130, label: 'Outer area'},
                
                // Points in hole area (inside inner rectangle)
                {x: 100, y: 100, label: 'Hole area'},
                {x: 125, y: 90, label: 'Hole area'},
                {x: 150, y: 110, label: 'Hole area'},
                
                // Points completely outside
                {x: 30, y: 80, label: 'Outside'},
                {x: 220, y: 100, label: 'Outside'},
            ];
            
            // Test with nonzero rule (left side) - overlay dots on the shape
            testPoints.forEach((point, i) => {
                // Recreate the same path for testing
                ctx.beginPath();
                ctx.rect(50, 50, 150, 100);
                ctx.rect(75, 75, 100, 50);
                
                const isInside = ctx.isPointInPath(point.x, point.y, 'nonzero');
                
                // Draw indicator dot directly on the shape
                ctx.fillStyle = isInside ? 'blue' : 'gray';
                ctx.beginPath();
                ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
                ctx.fill();
                
                // Add black border for visibility
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
                ctx.stroke();
            });
            
            // Test with evenodd rule (right side) - overlay dots on the shape
            testPoints.forEach((point, i) => {
                const offsetX = point.x + 230; // Offset for right side
                
                // Recreate the offset path for testing
                ctx.beginPath();
                ctx.rect(280, 50, 150, 100);
                ctx.rect(305, 75, 100, 50);
                
                const isInside = ctx.isPointInPath(offsetX, point.y, 'evenodd');
                
                // Draw indicator dot directly on the shape
                ctx.fillStyle = isInside ? 'red' : 'gray';
                ctx.beginPath();
                ctx.arc(offsetX, point.y, 4, 0, Math.PI * 2);
                ctx.fill();
                
                // Add black border for visibility
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(offsetX, point.y, 4, 0, Math.PI * 2);
                ctx.stroke();
            });
            
            // Simple visual legend at bottom
            ctx.fillStyle = 'blue';
            ctx.beginPath();
            ctx.arc(65, 165, 6, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(130, 165, 6, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = 'gray';
            ctx.beginPath();
            ctx.arc(195, 165, 6, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // Test: isPointInStroke Visual Test
    // This file will be concatenated into the main visual test suite

    // Test 136
    registerVisualTest('ispointinstroke-visual', {
        name: 'isPointInStroke visual verification - stroke hit testing',
        width: 400, height: 300,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 400, 300);
            
            // Test 1: Basic rectangular stroke with different widths
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.rect(50, 50, 100, 60);
            ctx.stroke();
            
            // Test points around the rectangular stroke
            const testPoints1 = [
                {x: 46, y: 80},   // On left edge of stroke
                {x: 154, y: 80},  // On right edge of stroke  
                {x: 100, y: 46},  // On top edge of stroke
                {x: 100, y: 114}, // On bottom edge of stroke
                {x: 100, y: 80},  // Inside path, not in stroke
                {x: 30, y: 80},   // Outside stroke
            ];
            
            // Draw test points for rectangular stroke
            testPoints1.forEach(point => {
                const isInStroke = ctx.isPointInStroke(point.x, point.y);
                ctx.fillStyle = isInStroke ? 'red' : 'blue';
                ctx.fillRect(point.x - 2, point.y - 2, 4, 4);
            });
            
            // Test 2: Line with different caps
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 12;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(220, 80);
            ctx.lineTo(320, 80);
            ctx.stroke();
            
            // Test points for line with round caps
            const testPoints2 = [
                {x: 214, y: 80}, // Within round cap
                {x: 326, y: 80}, // Within round cap
                {x: 270, y: 74}, // On line stroke
                {x: 270, y: 70}, // Outside line stroke
            ];
            
            // Draw test points for line stroke
            testPoints2.forEach(point => {
                const isInStroke = ctx.isPointInStroke(point.x, point.y);
                ctx.fillStyle = isInStroke ? 'red' : 'blue';
                ctx.fillRect(point.x - 2, point.y - 2, 4, 4);
            });
            
            // Test 3: Dashed line stroke
            ctx.strokeStyle = 'purple';
            ctx.lineWidth = 6;
            ctx.setLineDash([15, 10]); // 15px dash, 10px gap
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            ctx.moveTo(50, 150);
            ctx.lineTo(200, 150);
            ctx.stroke();
            
            // Test points for dashed line
            const testPoints3 = [
                {x: 60, y: 150}, // In first dash segment
                {x: 75, y: 150}, // In first gap
                {x: 90, y: 150}, // In second dash segment
                {x: 105, y: 150}, // In second gap
            ];
            
            // Draw test points for dashed stroke
            testPoints3.forEach(point => {
                const isInStroke = ctx.isPointInStroke(point.x, point.y);
                ctx.fillStyle = isInStroke ? 'red' : 'blue';
                ctx.fillRect(point.x - 2, point.y - 2, 4, 4);
            });
            
            // Test 4: Path with joins
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 8;
            ctx.lineJoin = 'miter';
            ctx.setLineDash([]); // Remove dashing
            ctx.beginPath();
            ctx.moveTo(250, 180);
            ctx.lineTo(300, 200);
            ctx.lineTo(350, 180);
            ctx.stroke();
            
            // Test points around the join
            const testPoints4 = [
                {x: 300, y: 196}, // At miter join
                {x: 300, y: 190}, // Inside the angle
                {x: 275, y: 190}, // On left line stroke
                {x: 325, y: 190}, // On right line stroke
            ];
            
            // Draw test points for join stroke
            testPoints4.forEach(point => {
                const isInStroke = ctx.isPointInStroke(point.x, point.y);
                ctx.fillStyle = isInStroke ? 'red' : 'blue';
                ctx.fillRect(point.x - 2, point.y - 2, 4, 4);
            });
            
            // Test 5: External path stroke (skip external path test in browser due to Path2D compatibility)
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 5;
            
            // Draw circle stroke using current path method (compatible with both environments)
            ctx.beginPath();
            ctx.arc(100, 230, 30, 0, Math.PI * 2);
            ctx.stroke();
            
            // Test points for circle stroke using current path (2-argument form)
            const testPoints5 = [
                {x: 130, y: 230}, // On circle stroke (right)
                {x: 70, y: 230},  // On circle stroke (left)
                {x: 100, y: 200}, // On circle stroke (top)
                {x: 100, y: 230}, // Inside circle
                {x: 150, y: 230}, // Outside circle
            ];
            
            // Draw test points for circle stroke using 2-argument form
            testPoints5.forEach(point => {
                const isInStroke = ctx.isPointInStroke(point.x, point.y);
                ctx.fillStyle = isInStroke ? 'red' : 'blue';
                ctx.fillRect(point.x - 2, point.y - 2, 4, 4);
            });
        }
    });

    // Test: isPointInPath with Path2D objects
    // This file will be concatenated into the main visual test suite

    // Test 137
    registerVisualTest('ispointinpath-path2d', {
        name: 'isPointInPath with Path2D objects - external path testing',
        width: 500, height: 400,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 500, 400);
            
            // Test 1: Rectangle Path2D
            const rectPath = createCompatiblePath2D(ctx);
            rectPath.rect(50, 50, 100, 80);
            
            ctx.fillStyle = 'lightblue';
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 2;
            
            // Use Path2D object directly for rendering (works in both environments)
            ctx.fill(rectPath);
            ctx.stroke(rectPath);
            
            // Test points for rectangle path
            const rectTestPoints = [
                {x: 100, y: 90},  // Inside rectangle
                {x: 30, y: 90},   // Outside rectangle (left)
                {x: 170, y: 90},  // Outside rectangle (right)
                {x: 100, y: 30},  // Outside rectangle (top)
                {x: 100, y: 150}, // Outside rectangle (bottom)
                {x: 50, y: 50},   // On rectangle edge
            ];
            
            rectTestPoints.forEach(point => {
                const isInPath = ctx.isPointInPath(rectPath, point.x, point.y);
                ctx.fillStyle = isInPath ? 'red' : 'blue';
                ctx.fillRect(point.x - 3, point.y - 3, 6, 6);
            });
            
            // Test 2: Circle Path2D
            const circlePath = createCompatiblePath2D(ctx);
            circlePath.arc(250, 90, 40, 0, Math.PI * 2);
            
            ctx.fillStyle = 'lightgreen';
            ctx.strokeStyle = 'darkgreen';
            ctx.lineWidth = 2;
            
            // Use Path2D object directly for rendering (works in both environments)
            ctx.fill(circlePath);
            ctx.stroke(circlePath);
            
            // Test points for circle path
            const circleTestPoints = [
                {x: 250, y: 90},  // Center of circle
                {x: 280, y: 90},  // Inside circle (right)
                {x: 220, y: 90},  // Inside circle (left)
                {x: 250, y: 60},  // Inside circle (top)
                {x: 250, y: 120}, // Inside circle (bottom)
                {x: 300, y: 90},  // Outside circle
                {x: 200, y: 90},  // Outside circle
            ];
            
            circleTestPoints.forEach(point => {
                const isInPath = ctx.isPointInPath(circlePath, point.x, point.y);
                ctx.fillStyle = isInPath ? 'red' : 'blue';
                ctx.fillRect(point.x - 3, point.y - 3, 6, 6);
            });
            
            // Test 3: Complex Path2D with curves
            const complexPath = createCompatiblePath2D(ctx);
            complexPath.moveTo(400, 50);
            complexPath.lineTo(450, 100);
            complexPath.quadraticCurveTo(460, 130, 430, 150);
            complexPath.lineTo(370, 130);
            complexPath.closePath();
            
            ctx.fillStyle = 'lightyellow';
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 2;
            
            // Use Path2D object directly for rendering (works in both environments)
            ctx.fill(complexPath);
            ctx.stroke(complexPath);
            
            // Test points for complex path
            const complexTestPoints = [
                {x: 420, y: 100}, // Inside complex path
                {x: 440, y: 120}, // Inside complex path
                {x: 350, y: 100}, // Outside complex path (left)
                {x: 470, y: 100}, // Outside complex path (right)
                {x: 420, y: 160}, // Outside complex path (below)
                {x: 410, y: 80},  // Inside complex path
            ];
            
            complexTestPoints.forEach(point => {
                const isInPath = ctx.isPointInPath(complexPath, point.x, point.y);
                ctx.fillStyle = isInPath ? 'red' : 'blue';
                ctx.fillRect(point.x - 3, point.y - 3, 6, 6);
            });
            
            // Test 4: Path2D with hole (evenodd fill rule)
            const pathWithHole = createCompatiblePath2D(ctx);
            pathWithHole.rect(50, 220, 120, 100);  // Outer rectangle
            pathWithHole.rect(80, 250, 60, 40);    // Inner rectangle (hole)
            
            ctx.fillStyle = 'lightcoral';
            ctx.strokeStyle = 'darkred';
            ctx.lineWidth = 2;
            
            // Fill with evenodd rule to create hole using Path2D object
            ctx.fill(pathWithHole, 'evenodd');
            ctx.stroke(pathWithHole);
            
            // Test points for path with hole using evenodd rule
            const holeTestPoints = [
                {x: 110, y: 270}, // In the hole (should be false with evenodd)
                {x: 60, y: 240},  // In outer part (should be true)
                {x: 160, y: 280}, // In outer part (should be true)
                {x: 30, y: 270},  // Outside entirely (should be false)
                {x: 190, y: 270}, // Outside entirely (should be false)
            ];
            
            holeTestPoints.forEach(point => {
                const isInPath = ctx.isPointInPath(pathWithHole, point.x, point.y, 'evenodd');
                ctx.fillStyle = isInPath ? 'red' : 'blue';
                ctx.fillRect(point.x - 3, point.y - 3, 6, 6);
            });
            
            // Test 5: Path2D with nonzero fill rule (same path as above)
            const pathNonzero = createCompatiblePath2D(ctx);
            pathNonzero.rect(250, 220, 120, 100);  // Outer rectangle
            pathNonzero.rect(280, 250, 60, 40);    // Inner rectangle
            
            ctx.fillStyle = 'lightpink';
            ctx.strokeStyle = 'purple';
            ctx.lineWidth = 2;
            
            // Fill with nonzero rule using Path2D object
            ctx.fill(pathNonzero, 'nonzero');
            ctx.stroke(pathNonzero);
            
            // Test points for path using nonzero rule
            const nonzeroTestPoints = [
                {x: 310, y: 270}, // In the "hole" area (should be true with nonzero)
                {x: 260, y: 240}, // In outer part (should be true)
                {x: 360, y: 280}, // In outer part (should be true)
                {x: 230, y: 270}, // Outside entirely (should be false)
                {x: 390, y: 270}, // Outside entirely (should be false)
            ];
            
            nonzeroTestPoints.forEach(point => {
                const isInPath = ctx.isPointInPath(pathNonzero, point.x, point.y, 'nonzero');
                ctx.fillStyle = isInPath ? 'red' : 'blue';
                ctx.fillRect(point.x - 3, point.y - 3, 6, 6);
            });
        }
    });

    // Test: isPointInStroke with Path2D objects
    // This file will be concatenated into the main visual test suite

    // Test 138
    registerVisualTest('ispointinstroke-path2d', {
        name: 'isPointInStroke with Path2D objects - external path stroke testing',
        width: 500, height: 400,
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 500, 400);
            
            // Test 1: Rectangle stroke with Path2D
            const rectPath = createCompatiblePath2D(ctx);
            rectPath.rect(50, 50, 100, 80);
            
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 8;
            
            // Use Path2D object directly for rendering (works in both environments)
            ctx.stroke(rectPath);
            
            // Test points for rectangle stroke
            const rectTestPoints = [
                {x: 46, y: 90},   // On left stroke edge
                {x: 154, y: 90},  // On right stroke edge
                {x: 100, y: 46},  // On top stroke edge
                {x: 100, y: 134}, // On bottom stroke edge
                {x: 100, y: 90},  // Inside rectangle (not in stroke)
                {x: 30, y: 90},   // Outside stroke entirely
                {x: 170, y: 90},  // Outside stroke entirely
            ];
            
            rectTestPoints.forEach(point => {
                const isInStroke = ctx.isPointInStroke(rectPath, point.x, point.y);
                ctx.fillStyle = isInStroke ? 'red' : 'blue';
                ctx.fillRect(point.x - 3, point.y - 3, 6, 6);
            });
            
            // Test 2: Line path with caps
            const linePath = createCompatiblePath2D(ctx);
            linePath.moveTo(250, 70);
            linePath.lineTo(400, 70);
            
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 12;
            ctx.lineCap = 'round';
            
            // Use Path2D object directly for rendering (works in both environments)
            ctx.stroke(linePath);
            
            // Test points for line stroke with round caps
            const lineTestPoints = [
                {x: 244, y: 70},  // Within round cap (left)
                {x: 406, y: 70},  // Within round cap (right)
                {x: 325, y: 70},  // On line stroke center
                {x: 325, y: 64},  // On line stroke edge
                {x: 325, y: 60},  // Outside line stroke
                {x: 200, y: 70},  // Outside stroke entirely
            ];
            
            lineTestPoints.forEach(point => {
                const isInStroke = ctx.isPointInStroke(linePath, point.x, point.y);
                ctx.fillStyle = isInStroke ? 'red' : 'blue';
                ctx.fillRect(point.x - 3, point.y - 3, 6, 6);
            });
            
            // Test 3: Complex path with joins
            const complexPath = createCompatiblePath2D(ctx);
            complexPath.moveTo(80, 150);
            complexPath.lineTo(130, 180);
            complexPath.lineTo(180, 150);
            complexPath.lineTo(220, 190);
            
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 10;
            ctx.lineJoin = 'miter';
            
            // Use Path2D object directly for rendering (works in both environments)
            ctx.stroke(complexPath);
            
            // Test points for complex path with miter joins
            const complexTestPoints = [
                {x: 105, y: 165}, // On first line segment
                {x: 130, y: 175}, // At miter join
                {x: 155, y: 165}, // On second line segment
                {x: 200, y: 170}, // On third line segment
                {x: 130, y: 160}, // Inside the angle (not in stroke)
                {x: 60, y: 160},  // Outside stroke entirely
            ];
            
            complexTestPoints.forEach(point => {
                const isInStroke = ctx.isPointInStroke(complexPath, point.x, point.y);
                ctx.fillStyle = isInStroke ? 'red' : 'blue';
                ctx.fillRect(point.x - 3, point.y - 3, 6, 6);
            });
            
            // Test 4: Circle stroke with Path2D
            const circlePath = createCompatiblePath2D(ctx);
            circlePath.arc(350, 180, 35, 0, Math.PI * 2);
            
            ctx.strokeStyle = 'purple';
            ctx.lineWidth = 6;
            
            // Use Path2D object directly for rendering (works in both environments)
            ctx.stroke(circlePath);
            
            // Test points for circle stroke
            const circleTestPoints = [
                {x: 385, y: 180}, // On right edge of stroke
                {x: 315, y: 180}, // On left edge of stroke
                {x: 350, y: 145}, // On top edge of stroke
                {x: 350, y: 215}, // On bottom edge of stroke
                {x: 350, y: 180}, // Center of circle (not in stroke)
                {x: 400, y: 180}, // Outside stroke entirely
            ];
            
            circleTestPoints.forEach(point => {
                const isInStroke = ctx.isPointInStroke(circlePath, point.x, point.y);
                ctx.fillStyle = isInStroke ? 'red' : 'blue';
                ctx.fillRect(point.x - 3, point.y - 3, 6, 6);
            });
            
            // Test 5: Dashed line stroke with Path2D
            const dashedPath = createCompatiblePath2D(ctx);
            dashedPath.moveTo(50, 280);
            dashedPath.lineTo(250, 280);
            
            ctx.strokeStyle = 'darkred';
            ctx.lineWidth = 8;
            ctx.setLineDash([20, 15]); // 20px dash, 15px gap
            ctx.lineDashOffset = 0;
            
            // Use Path2D object directly for rendering (works in both environments)
            ctx.stroke(dashedPath);
            
            // Test points for dashed line stroke
            const dashedTestPoints = [
                {x: 60, y: 280},  // In first dash segment
                {x: 85, y: 280},  // In first gap
                {x: 110, y: 280}, // In second dash segment
                {x: 135, y: 280}, // In second gap
                {x: 160, y: 280}, // In third dash segment
                {x: 180, y: 280}, // In third gap
            ];
            
            dashedTestPoints.forEach(point => {
                const isInStroke = ctx.isPointInStroke(dashedPath, point.x, point.y);
                ctx.fillStyle = isInStroke ? 'red' : 'blue';
                ctx.fillRect(point.x - 3, point.y - 3, 6, 6);
            });
            
            // Test 6: Quadratic curve stroke with Path2D
            const curvePath = createCompatiblePath2D(ctx);
            curvePath.moveTo(300, 250);
            curvePath.quadraticCurveTo(400, 300, 450, 250);
            
            ctx.strokeStyle = 'darkblue';
            ctx.lineWidth = 6;
            ctx.setLineDash([]); // Reset dashing
            
            // Use Path2D object directly for rendering (works in both environments)
            ctx.stroke(curvePath);
            
            // Test points for curved stroke
            const curveTestPoints = [
                {x: 320, y: 260}, // On curve stroke
                {x: 375, y: 285}, // On curve stroke
                {x: 430, y: 260}, // On curve stroke
                {x: 375, y: 250}, // Inside curve area (not on stroke)
                {x: 375, y: 320}, // Outside curve entirely
                {x: 280, y: 250}, // Outside curve entirely
            ];
            
            curveTestPoints.forEach(point => {
                const isInStroke = ctx.isPointInStroke(curvePath, point.x, point.y);
                ctx.fillStyle = isInStroke ? 'red' : 'blue';
                ctx.fillRect(point.x - 3, point.y - 3, 6, 6);
            });
            
            // Test 7: Zero-width stroke with Path2D
            const zeroWidthPath = createCompatiblePath2D(ctx);
            zeroWidthPath.moveTo(50, 350);
            zeroWidthPath.lineTo(200, 350);
            
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 0; // Zero-width stroke
            
            // Use Path2D object directly for rendering (works in both environments)
            ctx.stroke(zeroWidthPath);
            
            // Test points for zero-width stroke
            const zeroWidthTestPoints = [
                {x: 125, y: 350}, // On the path line
                {x: 125, y: 351}, // Off the path line
                {x: 125, y: 349}, // Off the path line
                {x: 30, y: 350},  // Outside path entirely
            ];
            
            zeroWidthTestPoints.forEach(point => {
                const isInStroke = ctx.isPointInStroke(zeroWidthPath, point.x, point.y);
                ctx.fillStyle = isInStroke ? 'red' : 'blue';
                ctx.fillRect(point.x - 3, point.y - 3, 6, 6);
            });
        }
    });

    // Test: Shadow Basic Test
    // Tests basic shadow functionality with simple rectangles and different shadow configurations.

    registerVisualTest('shadow-basic-test', {
        name: 'Shadow Basic Test',
        width: 200, height: 200,
        // Unified drawing function that works with both canvas types
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 200);
            
            // Test 1: Basic drop shadow - red rectangle
            ctx.shadowColor = 'rgba(100, 100, 100, 0.5)'; // Semi-transparent gray
            ctx.shadowBlur = 5;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;
            
            ctx.fillStyle = 'red';
            ctx.fillRect(20, 20, 40, 30);
            
            // Test 2: Blue shadow - green rectangle  
            ctx.shadowColor = 'rgba(0, 0, 255, 0.39)'; // Blue shadow
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = -3;
            ctx.shadowOffsetY = 7;
            
            ctx.fillStyle = 'rgb(0, 200, 0)'; // Green
            ctx.fillRect(80, 30, 35, 35);
            
            // Test 3: No blur, just offset - yellow rectangle
            ctx.shadowColor = 'rgba(0, 0, 0, 0.31)'; // Black shadow
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 10;
            ctx.shadowOffsetY = -5;
            
            ctx.fillStyle = 'yellow';
            ctx.fillRect(140, 40, 30, 25);
            
            // Test 4: Large blur, small offset - purple rectangle
            ctx.shadowColor = 'rgba(255, 0, 255, 0.24)'; // Magenta shadow
            ctx.shadowBlur = 15;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            
            ctx.fillStyle = 'rgb(128, 0, 128)'; // Purple
            ctx.fillRect(30, 100, 50, 20);
            
            // Test 5: No shadow - orange rectangle for comparison
            ctx.shadowColor = 'transparent'; // No shadow
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            ctx.fillStyle = 'orange';
            ctx.fillRect(120, 110, 40, 30);
        }
    });

    // Test: Shadow Stroke Test
    // Tests shadow functionality with strokes and different stroke properties.

    registerVisualTest('shadow-stroke-test', {
        name: 'Shadow Stroke Test',
        width: 200, height: 200,
        // Unified drawing function that works with both canvas types
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');
            
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 200);
            
            // Test 1: Basic stroke shadow - simple line
            ctx.shadowColor = 'rgba(0, 0, 0, 0.39)'; // Semi-transparent black
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;
            
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(20, 30);
            ctx.lineTo(80, 30);
            ctx.stroke();
            
            // Test 2: Circle with shadow
            ctx.shadowColor = 'rgba(0, 100, 200, 0.31)'; // Blue shadow
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = -2;
            ctx.shadowOffsetY = 4;
            
            ctx.strokeStyle = 'rgb(0, 150, 0)'; // Green stroke
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(140, 50, 25, 0, 2 * Math.PI);
            ctx.stroke();
            
            // Test 3: Rectangle stroke with large blur
            ctx.shadowColor = 'rgba(150, 0, 150, 0.24)'; // Purple shadow
            ctx.shadowBlur = 12;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = -3;
            
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.rect(30, 100, 50, 30);
            ctx.stroke();
            
            // Test 4: Path with multiple segments
            ctx.shadowColor = 'rgba(100, 50, 0, 0.35)'; // Brown shadow
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 6;
            
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(120, 120);
            ctx.lineTo(140, 100);
            ctx.lineTo(160, 120);
            ctx.lineTo(180, 100);
            ctx.stroke();
            
            // Test 5: Thin stroke with shadow (sub-pixel test)
            ctx.shadowColor = 'rgba(0, 0, 0, 0.47)'; // Black shadow
            ctx.shadowBlur = 2;
            ctx.shadowOffsetX = 4;
            ctx.shadowOffsetY = 2;
            
            ctx.strokeStyle = 'magenta';
            ctx.lineWidth = 0.5; // Sub-pixel width
            ctx.beginPath();
            ctx.moveTo(20, 170);
            ctx.lineTo(180, 170);
            ctx.stroke();
        }
    });

    // Test: Shadow Clipping Test
    // Tests shadow functionality with clip paths to verify shadows respect clipping regions.

    registerVisualTest('shadow-clipping-test', {
        name: 'Shadow Clipping Test',
        width: 200, height: 200,
        // Unified drawing function that works with both canvas types
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');

            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 200);

            // Test 1: Rectangle with shadow, clipped to circle
            ctx.save();
            ctx.beginPath();
            ctx.arc(50, 50, 35, 0, 2 * Math.PI);
            ctx.clip();

            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = 10;
            ctx.shadowOffsetY = 10;

            ctx.fillStyle = 'blue';
            ctx.fillRect(20, 20, 60, 60);
            ctx.restore();

            // Test 2: Circle with shadow, clipped to rectangle
            ctx.save();
            ctx.beginPath();
            ctx.rect(110, 20, 70, 60);
            ctx.clip();

            ctx.shadowColor = 'rgba(255, 0, 0, 0.4)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = -5;
            ctx.shadowOffsetY = 8;

            ctx.fillStyle = 'green';
            ctx.beginPath();
            ctx.arc(145, 50, 30, 0, 2 * Math.PI);
            ctx.fill();
            ctx.restore();

            // Test 3: Shadow with no blur, clipped to diagonal path
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(20, 100);
            ctx.lineTo(80, 100);
            ctx.lineTo(80, 180);
            ctx.lineTo(20, 180);
            ctx.closePath();
            ctx.clip();

            ctx.shadowColor = 'rgba(128, 0, 128, 0.6)';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 8;
            ctx.shadowOffsetY = -5;

            ctx.fillStyle = 'orange';
            ctx.fillRect(30, 120, 40, 40);
            ctx.restore();

            // Test 4: Stroked path with shadow inside clip region
            ctx.save();
            ctx.beginPath();
            ctx.arc(145, 140, 40, 0, 2 * Math.PI);
            ctx.clip();

            ctx.shadowColor = 'rgba(0, 100, 200, 0.5)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;

            ctx.strokeStyle = 'magenta';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.rect(115, 110, 60, 60);
            ctx.stroke();
            ctx.restore();
        }
    });


    // Test: Shadow Rotation Test
    // Tests shadow functionality with rotated and transformed shapes.
    // Verifies shadow offset direction is correct under transformations.

    registerVisualTest('shadow-rotation-test', {
        name: 'Shadow Rotation Test',
        width: 200, height: 200,
        // Unified drawing function that works with both canvas types
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');

            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 200);

            // Test 1: Rotated rectangle with shadow
            ctx.save();
            ctx.translate(50, 50);
            ctx.rotate(Math.PI / 6); // 30 degrees

            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 5;
            ctx.shadowOffsetX = 6;
            ctx.shadowOffsetY = 6;

            ctx.fillStyle = 'red';
            ctx.fillRect(-20, -15, 40, 30);
            ctx.restore();

            // Test 2: Scaled rectangle with shadow
            ctx.save();
            ctx.translate(140, 50);
            ctx.scale(1.5, 0.8);

            ctx.shadowColor = 'rgba(0, 100, 0, 0.4)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;

            ctx.fillStyle = 'blue';
            ctx.fillRect(-15, -15, 30, 30);
            ctx.restore();

            // Test 3: Rotated + scaled shape with shadow
            ctx.save();
            ctx.translate(50, 140);
            ctx.rotate(-Math.PI / 4); // -45 degrees
            ctx.scale(1.2, 1.2);

            ctx.shadowColor = 'rgba(200, 0, 200, 0.45)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = -4;
            ctx.shadowOffsetY = 7;

            ctx.fillStyle = 'green';
            ctx.beginPath();
            ctx.arc(0, 0, 20, 0, 2 * Math.PI);
            ctx.fill();
            ctx.restore();

            // Test 4: Skewed rectangle with shadow
            ctx.save();
            ctx.translate(145, 135);
            ctx.transform(1, 0.3, 0.2, 1, 0, 0); // skew transform

            ctx.shadowColor = 'rgba(100, 50, 0, 0.5)';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 4;
            ctx.shadowOffsetY = 4;

            ctx.fillStyle = 'orange';
            ctx.fillRect(-20, -15, 40, 30);
            ctx.restore();
        }
    });


    // Test: Shadow Gradient Test
    // Tests shadow functionality with gradient-filled shapes.

    registerVisualTest('shadow-gradient-test', {
        name: 'Shadow Gradient Test',
        width: 200, height: 200,
        // Unified drawing function that works with both canvas types
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');

            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 200);

            // Test 1: Linear gradient rectangle with shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;

            var linearGradient = ctx.createLinearGradient(15, 15, 85, 75);
            linearGradient.addColorStop(0, 'red');
            linearGradient.addColorStop(1, 'yellow');
            ctx.fillStyle = linearGradient;
            ctx.fillRect(15, 15, 70, 60);

            // Test 2: Radial gradient circle with shadow
            ctx.shadowColor = 'rgba(0, 0, 150, 0.4)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = -4;
            ctx.shadowOffsetY = 6;

            var radialGradient = ctx.createRadialGradient(145, 45, 5, 145, 45, 35);
            radialGradient.addColorStop(0, 'white');
            radialGradient.addColorStop(0.5, 'blue');
            radialGradient.addColorStop(1, 'darkblue');
            ctx.fillStyle = radialGradient;
            ctx.beginPath();
            ctx.arc(145, 45, 35, 0, 2 * Math.PI);
            ctx.fill();

            // Test 3: Linear gradient with multiple stops, no blur shadow
            ctx.shadowColor = 'rgba(100, 0, 100, 0.6)';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 8;
            ctx.shadowOffsetY = -5;

            var multiGradient = ctx.createLinearGradient(15, 110, 85, 110);
            multiGradient.addColorStop(0, 'green');
            multiGradient.addColorStop(0.5, 'cyan');
            multiGradient.addColorStop(1, 'blue');
            ctx.fillStyle = multiGradient;
            ctx.fillRect(15, 110, 70, 50);

            // Test 4: Radial gradient with large blur shadow
            ctx.shadowColor = 'rgba(200, 100, 0, 0.35)';
            ctx.shadowBlur = 12;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;

            var orangeGradient = ctx.createRadialGradient(145, 145, 0, 145, 145, 40);
            orangeGradient.addColorStop(0, 'yellow');
            orangeGradient.addColorStop(1, 'darkorange');
            ctx.fillStyle = orangeGradient;
            ctx.fillRect(105, 105, 80, 80);
        }
    });


    // Test: Shadow Large Blur Test
    // Tests edge cases with large blur radius (30+) to verify blur algorithm handles them correctly.

    registerVisualTest('shadow-large-blur-test', {
        name: 'Shadow Large Blur Test',
        width: 200, height: 200,
        // Unified drawing function that works with both canvas types
        draw: function(canvas) {
            const ctx = canvas.getContext('2d');

            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 200, 200);

            // Test 1: Very large blur (30px) on small rectangle
            ctx.shadowColor = 'rgba(0, 0, 100, 0.4)';
            ctx.shadowBlur = 30;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            ctx.fillStyle = 'red';
            ctx.fillRect(30, 30, 30, 30);

            // Test 2: Large blur (25px) with offset
            ctx.shadowColor = 'rgba(100, 0, 0, 0.35)';
            ctx.shadowBlur = 25;
            ctx.shadowOffsetX = 8;
            ctx.shadowOffsetY = 8;

            ctx.fillStyle = 'blue';
            ctx.fillRect(130, 30, 35, 35);

            // Test 3: Large blur (35px) on circle
            ctx.shadowColor = 'rgba(0, 100, 0, 0.3)';
            ctx.shadowBlur = 35;
            ctx.shadowOffsetX = -5;
            ctx.shadowOffsetY = 5;

            ctx.fillStyle = 'orange';
            ctx.beginPath();
            ctx.arc(55, 140, 20, 0, 2 * Math.PI);
            ctx.fill();

            // Test 4: Large blur on stroked path
            ctx.shadowColor = 'rgba(100, 0, 100, 0.3)';
            ctx.shadowBlur = 28;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;

            ctx.strokeStyle = 'green';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.rect(115, 110, 50, 50);
            ctx.stroke();

            // Reset shadow to disable for cleanup
            ctx.shadowColor = 'transparent';
        }
    });


    const VisualRenderingTests = {
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

})(typeof window !== "undefined" ? window : global);